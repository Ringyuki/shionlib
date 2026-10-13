package inspection

import (
	"context"
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type PreviewService struct {
	repo      Repository
	resources Resources
	previews  PreviewStore
}

func NewPreviewService(repo Repository, resources Resources, previews PreviewStore) *PreviewService {
	return &PreviewService{repo: repo, resources: resources, previews: previews}
}

func (s *PreviewService) Text(ctx context.Context, viewer actor.Actor, entryID int) (TextPreview, error) {
	entry, data, err := s.read(ctx, viewer, entryID, PreviewText, TextPreviewMaxBytes)
	if err != nil {
		return TextPreview{}, err
	}
	encoding := DetectEncoding(data)
	if encoding == EncodingUnknown {
		encoding = EncodingUTF8
	}
	return TextPreview{Entry: entry, Data: data, Encoding: encoding}, nil
}

func (s *PreviewService) Image(ctx context.Context, viewer actor.Actor, entryID int) ([]byte, error) {
	_, data, err := s.read(ctx, viewer, entryID, PreviewImage, ImagePreviewMaxBytes)
	return data, err
}

func (s *PreviewService) read(ctx context.Context, viewer actor.Actor, entryID int, kind Preview, limit int64) (Entry, []byte, error) {
	entry, err := s.repo.GetEntry(ctx, entryID)
	if err != nil {
		return Entry{}, nil, err
	}
	if err := visible(ctx, s.repo, s.resources, viewer, entry.InspectionID); errors.Is(err, ErrNotFound) {
		return Entry{}, nil, ErrEntryNotFound
	} else if err != nil {
		return Entry{}, nil, err
	}
	if entry.Preview != kind {
		return Entry{}, nil, ErrNoPreview
	}
	data, err := s.previews.GetBytes(ctx, previewKey(entry.InspectionID, entryID), limit)
	if err != nil {
		return Entry{}, nil, err
	}
	return entry, data, nil
}
