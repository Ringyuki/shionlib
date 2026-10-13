package composition

import (
	"context"
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type ReadService struct {
	drafts   *Service
	examiner Examiner
	patches  Patches
	notices  *NoticeService
}

func NewReadService(drafts *Service, examiner Examiner, patches Patches, notices *NoticeService) *ReadService {
	return &ReadService{drafts: drafts, examiner: examiner, patches: patches, notices: notices}
}

func (r *ReadService) Read(ctx context.Context, job Read) error {
	repo := r.drafts.repo
	composition, err := repo.Get(ctx, job.CompositionID)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	input := composition.input(job.Role)
	if input == nil || input.State != InputReading {
		return nil
	}
	finding, err := r.examiner.Examine(ctx, scan.LocalFile{Name: input.Name, Path: input.Path, Size: input.Size}, false)
	if err != nil {
		return err
	}
	read, entries := readInput(*input, finding)
	var match *Match
	if job.Role == RolePatch && read.Ready() {
		if match, err = r.match(ctx, composition, read.SHA256); err != nil {
			return err
		}
	}
	var settled *Composition
	err = r.drafts.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := repo.Lock(ctx, composition.ID)
		if errors.Is(err, ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		waiting := current.input(job.Role)
		if current.State != StateDraft || waiting == nil || waiting.State != InputReading || waiting.Path != input.Path {
			return nil
		}
		current.setInput(job.Role, &read)
		if err := repo.SetEntries(ctx, current.ID, job.Role, entries); err != nil {
			return err
		}
		if job.Role == RolePatch {
			current.Match = match
			if err := r.drafts.draw(ctx, Owner(current), &current); err != nil {
				return err
			}
		}
		if current.Rebuild() {
			if err := r.settle(ctx, &current); err != nil {
				return err
			}
			settled = &current
		}
		r.drafts.touch(&current)
		return repo.Save(ctx, current)
	})
	if err != nil || settled == nil || settled.State != StateFailed {
		return err
	}
	return r.notices.Failed(ctx, *settled)
}

func readInput(input Input, finding scan.LocalFinding) (Input, []Entry) {
	read := input
	read.SHA256 = finding.SHA256
	read.Encoding = finding.Encoding
	refuse := func(reason Refusal) (Input, []Entry) {
		read.State = InputRefused
		read.Refusal = &reason
		return read, nil
	}
	switch {
	case finding.Status == download.CheckEncrypted:
		return refuse(RefusalEncrypted)
	case finding.Status != download.CheckOK:
		return refuse(RefusalBroken)
	case !finding.Container:
		return refuse(RefusalNotArchive)
	case finding.Infected():
		read.Viruses = finding.Viruses
		return refuse(RefusalHarmful)
	case len(finding.Files) > InputEntryLimit:
		return refuse(RefusalTooManyFile)
	}
	entries := make([]Entry, 0, len(finding.Files))
	for _, file := range finding.Files {
		if cleaned := CleanPath(file.Path); cleaned != "" {
			entries = append(entries, Entry{Path: cleaned, Size: file.Size})
		}
	}
	read.State = InputReady
	read.Refusal = nil
	read.Files = len(entries)
	read.Unpacked = finding.Unpacked
	return read, entries
}

func (r *ReadService) match(ctx context.Context, composition Composition, sha256 string) (*Match, error) {
	if sha256 == "" {
		return nil, nil
	}
	entry, found, err := r.patches.ByHash(ctx, Owner(composition), composition.GameID, sha256)
	if err != nil || !found {
		return nil, err
	}
	match := MatchOf(entry)
	return &match, nil
}

func (r *ReadService) settle(ctx context.Context, composition *Composition) error {
	now := r.drafts.now()
	if !composition.Patch.Ready() {
		detail := ""
		if composition.Patch != nil && composition.Patch.Refusal != nil {
			detail = string(*composition.Patch.Refusal)
		}
		composition.Fail(FailurePatchUnreadable, detail, now)
		return nil
	}
	err := r.drafts.launch(ctx, Owner(*composition), composition)
	reason, refused := refusalOf(err)
	if !refused {
		return err
	}
	composition.Fail(reason, "", now)
	return nil
}

func refusalOf(err error) (Failure, bool) {
	switch {
	case err == nil:
		return "", false
	case errors.Is(err, ErrNothingToApply):
		return FailureNothing, true
	case errors.Is(err, ErrPathConflict):
		return FailureConflict, true
	case errors.Is(err, ErrQueueFull):
		return FailureQueueFull, true
	case errors.Is(err, ErrBaseGone), errors.Is(err, ErrBaseUnusable):
		return FailureBaseGone, true
	case errors.Is(err, upload.ErrQuotaExceeded), errors.Is(err, upload.ErrInFlightExceeded), errors.Is(err, upload.ErrTooLarge):
		return FailureQuota, true
	}
	return "", false
}
