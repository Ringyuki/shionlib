package scan

import (
	"context"
	"errors"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type StalledService struct {
	checks *Service
}

func NewStalledService(checks *Service) *StalledService {
	return &StalledService{checks: checks}
}

func (s *StalledService) Abandon(ctx context.Context) error {
	checks := s.checks
	since := checks.now().Add(-StalledCheckTimeout.Read(checks.settings))
	files, err := checks.repo.StalledFiles(ctx, &since, stalledCheckBatch)
	if err != nil {
		return err
	}
	var errs []error
	for _, unit := range stalledUnits(files) {
		if err := checks.rejectWhen(ctx, unit, download.CheckAbandoned, stalledSameUpload); err != nil {
			errs = append(errs, fmt.Errorf("abandon the check of %v: %w", unit.Names(), err))
		}
	}
	return errors.Join(errs...)
}

func (s *StalledService) Resume(ctx context.Context, fileIDs []int) ([]Resumed, error) {
	checks := s.checks
	files, err := checks.repo.StalledFiles(ctx, nil, 0)
	if err != nil {
		return nil, err
	}
	var resumed []Resumed
	for _, unit := range stalledUnits(files) {
		if !unit.wanted(fileIDs) {
			continue
		}
		done := false
		err := checks.withUnchanged(ctx, unit, stalledSameUpload, func(ctx context.Context, current []PendingFile) error {
			for _, file := range current {
				if err := checks.repo.ResumeCheck(ctx, file.ID); err != nil {
					return err
				}
			}
			done = true
			return checks.repo.DelayCheck(ctx, unit.Entry().ResourceID, checks.now())
		})
		if err != nil {
			return resumed, fmt.Errorf("resume the check of %v: %w", unit.Names(), err)
		}
		if done {
			resumed = append(resumed, Resumed{ResourceID: unit.Entry().ResourceID, Files: unit.Names()})
		}
	}
	return resumed, nil
}

func (s *StalledService) List(ctx context.Context) ([]StalledEntry, error) {
	checks := s.checks
	entries, err := checks.repo.StalledEntries(ctx, stalledListLimit)
	if err != nil {
		return nil, err
	}
	keep := StalledCheckTimeout.Read(checks.settings)
	for i := range entries {
		if at := entries[i].File.StalledAt; at != nil {
			entries[i].Deadline = at.Add(keep)
		}
	}
	return entries, nil
}

func (s *StalledService) Recheck(ctx context.Context, fileID int) error {
	resumed, err := s.Resume(ctx, []int{fileID})
	if err != nil {
		return err
	}
	if len(resumed) == 0 {
		return ErrCheckNotStalled
	}
	return nil
}

func (s *StalledService) Remove(ctx context.Context, fileID int) error {
	checks := s.checks
	files, err := checks.repo.StalledFiles(ctx, nil, 0)
	if err != nil {
		return err
	}
	for _, unit := range stalledUnits(files) {
		if unit.wanted([]int{fileID}) {
			return checks.rejectWhen(ctx, unit, download.CheckAbandoned, stalledSameUpload)
		}
	}
	return ErrCheckNotStalled
}
