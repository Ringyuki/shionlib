package inspection

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"
)

type RecordService struct {
	repo     Repository
	previews PreviewStore
	images   ImageShrinker
	tx       Transactor
	now      func() time.Time
}

func NewRecordService(repo Repository, previews PreviewStore, images ImageShrinker, tx Transactor, now func() time.Time) *RecordService {
	return &RecordService{repo: repo, previews: previews, images: images, tx: tx, now: now}
}

func (s *RecordService) Record(ctx context.Context, draft Draft) (Recorded, error) {
	arranged := draft.arrange()
	recorded := Recorded{Entries: make([]int, len(arranged.entries))}
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		id, err := s.repo.Create(ctx, NewInspection{
			ResourceID: draft.ResourceID,
			Status:     draft.Status,
			Archive:    draft.Archive,
			Totals:     arranged.totals,
			Truncated:  arranged.truncated,
			Verified:   draft.Verified,
			Scan:       draft.Scan,
		})
		if err != nil {
			return err
		}
		recorded.ID = id
		for _, level := range arranged.levels {
			for start := 0; start < len(level); start += entryBatch {
				batch := level[start:min(start+entryBatch, len(level))]
				entries := make([]NewEntry, len(batch))
				for i, index := range batch {
					entries[i] = arranged.entries[index]
					if parent := draft.Entries[index].Parent; parent != TopLevel {
						entries[i].ParentID = &recorded.Entries[parent]
					}
				}
				ids, err := s.repo.AddEntries(ctx, id, entries)
				if err != nil {
					return err
				}
				if len(ids) != len(batch) {
					return fmt.Errorf("stored %d of %d entries of inspection %d", len(ids), len(batch), id)
				}
				for i, index := range batch {
					recorded.Entries[index] = ids[i]
				}
			}
		}
		return nil
	})
	if err != nil {
		return Recorded{}, err
	}
	return recorded, nil
}

func (s *RecordService) KeepPreview(ctx context.Context, inspectionID, entryID int, kind Preview, content io.Reader) error {
	limit := int64(TextPreviewMaxBytes)
	if kind == PreviewImage {
		limit = ImagePreviewMaxBytes
	}
	data, err := io.ReadAll(io.LimitReader(content, limit+1))
	if err != nil {
		return fmt.Errorf("read the preview of entry %d: %w", entryID, err)
	}
	if int64(len(data)) > limit {
		return nil
	}
	contentType := "application/octet-stream"
	switch kind {
	case PreviewText:
		if !LooksLikeText(data) {
			return nil
		}
	case PreviewImage:
		data, err = s.images.Shrink(ctx, data, ImagePreviewLongest)
		if errors.Is(err, ErrUnreadableImage) {
			return nil
		}
		if err != nil {
			return err
		}
		contentType = PreviewImageType
	default:
		return nil
	}
	if err := s.previews.PutBytes(ctx, previewKey(inspectionID, entryID), data, contentType, nil); err != nil {
		return err
	}
	return s.repo.SetPreview(ctx, entryID, kind)
}

func (s *RecordService) Cleared(ctx context.Context, ids []int) error {
	if len(ids) == 0 {
		return nil
	}
	return s.repo.MarkCleared(ctx, ids, s.now())
}

func (s *RecordService) Sweep(ctx context.Context) error {
	orphans, err := s.repo.Orphans(ctx, s.now().Add(-orphanAge), sweepBatch)
	if err != nil {
		return err
	}
	var errs []error
	for _, id := range orphans {
		if err := s.discard(ctx, id); err != nil {
			errs = append(errs, fmt.Errorf("discard inspection %d: %w", id, err))
		}
	}
	return errors.Join(errs...)
}

func (s *RecordService) discard(ctx context.Context, id int) error {
	entries, err := s.repo.PreviewEntries(ctx, id)
	if err != nil {
		return err
	}
	for _, entryID := range entries {
		if err := s.previews.Delete(ctx, previewKey(id, entryID)); err != nil {
			return err
		}
	}
	return s.repo.Delete(ctx, id)
}
