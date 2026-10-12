package scan

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type BackfillService struct {
	checks  *Service
	objects Objects
	spool   Spool
}

func NewBackfillService(checks *Service, objects Objects, spool Spool) *BackfillService {
	return &BackfillService{checks: checks, objects: objects, spool: spool}
}

func (s *BackfillService) Next(ctx context.Context, skip []int) (Backfilled, bool, error) {
	resourceID, found, err := s.checks.repo.NextUninspected(ctx, skip)
	if err != nil || !found {
		return Backfilled{}, false, err
	}
	done := Backfilled{ResourceID: resourceID}
	files, err := s.checks.repo.ResourceFiles(ctx, resourceID)
	if err != nil {
		return done, true, err
	}
	stored := slices.DeleteFunc(files, func(file PendingFile) bool { return !file.awaitingInspection() })
	for _, unit := range Units(stored) {
		outcome, err := s.inspect(ctx, unit)
		if err != nil {
			return done, true, fmt.Errorf("inspect %v of resource %d: %w", unit.Names(), resourceID, err)
		}
		done.Units = append(done.Units, BackfilledUnit{Files: unit.Names(), Outcome: outcome})
	}
	return done, true, nil
}

func (s *BackfillService) inspect(ctx context.Context, unit Unit) (BackfillOutcome, error) {
	checks := s.checks
	var size int64
	for _, file := range unit.Files {
		size += file.Size
	}
	room, err := s.spool.SpoolRoom(ctx)
	if err != nil {
		return "", err
	}
	if size > room {
		return "", fmt.Errorf("fetching %d bytes needs more than the %d bytes the spool can spare", size, room)
	}
	workspace, err := checks.workspace.Create(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = checks.workspace.Discard(context.WithoutCancel(ctx), workspace) }()
	local := Unit{Scheme: unit.Scheme, Missing: unit.Missing, Absent: unit.Absent, Files: slices.Clone(unit.Files)}
	for i, file := range local.Files {
		local.Files[i].Path = filepath.Join(workspace, storedDir, strconv.Itoa(file.ID))
		err := s.objects.Fetch(ctx, file.StorageKey, local.Files[i].Path)
		if errors.Is(err, ErrObjectMissing) {
			return BackfillMissing, nil
		}
		if err != nil {
			return "", err
		}
	}
	if !local.Complete() {
		return BackfillUnreadable, s.attachFailure(ctx, unit, local)
	}
	found, err := checks.examine(ctx, local, workspace)
	if err != nil {
		return "", err
	}
	if found.archive.Status != download.CheckOK {
		return BackfillUnreadable, s.attachFailure(ctx, unit, local)
	}
	result, err := checks.record(ctx, local, found.archive, found.contents, found.reports)
	if err != nil {
		return "", err
	}
	outcome := BackfillInspected
	if found.report.Infected {
		outcome = BackfillHeld
		err = checks.quarantine(ctx, unit, found.report, result, storedUnchanged)
	} else {
		err = checks.withUnchanged(ctx, unit, storedUnchanged, func(ctx context.Context, current []PendingFile) error {
			return checks.attachTo(ctx, current, result)
		})
	}
	if err != nil {
		return "", err
	}
	return outcome, checks.keepPreviews(ctx, result.recorded, found.contents.Previews)
}

func (s *BackfillService) attachFailure(ctx context.Context, unit, local Unit) error {
	digests, err := s.checks.digests(ctx, local)
	if err != nil {
		return err
	}
	recorded, err := s.checks.inspections.Record(ctx, inspection.Draft{ResourceID: unit.Entry().ResourceID, Status: inspection.StatusFailed})
	if err != nil {
		return err
	}
	return s.checks.withUnchanged(ctx, unit, storedUnchanged, func(ctx context.Context, current []PendingFile) error {
		return s.checks.attachTo(ctx, current, checked{recorded: recorded, digests: digests})
	})
}
