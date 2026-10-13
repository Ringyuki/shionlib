package scan

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type LocalService struct {
	checks *Service
}

func NewLocalService(checks *Service) *LocalService {
	return &LocalService{checks: checks}
}

func (l *LocalService) Checking() bool {
	return l.checks.options.Enabled
}

func (l *LocalService) Examine(ctx context.Context, file LocalFile, record bool) (LocalFinding, error) {
	s := l.checks
	if !s.options.Enabled {
		return LocalFinding{}, ErrChecksDisabled
	}
	workspace, err := s.workspace.Create(ctx)
	if err != nil {
		return LocalFinding{}, err
	}
	defer func() { _ = s.workspace.Discard(context.WithoutCancel(ctx), workspace) }()
	unit := Unit{Files: []PendingFile{{ResourceID: file.ResourceID, Name: file.Name, Path: file.Path, Size: file.Size}}}
	found, err := s.examine(ctx, unit, workspace)
	if err != nil {
		return LocalFinding{}, err
	}
	finding := LocalFinding{Status: found.archive.Status}
	if found.archive.Status != download.CheckOK {
		return finding, nil
	}
	finding.Format = found.archive.Facts.Format
	finding.Container = Container(found.archive.Facts.Format)
	finding.Encoding = found.contents.NameEncoding
	finding.Files, finding.Unpacked = ownFiles(found.contents.Draft)
	finding.Detections = Detections(found.reports)
	if found.report.Infected {
		finding.Viruses = found.report.Viruses
	}
	if !record || found.report.Infected {
		finding.SHA256, err = s.digest(ctx, file.Path)
		return finding, err
	}
	result, err := s.record(ctx, unit, found.archive, found.contents, found.reports)
	if err != nil {
		return LocalFinding{}, err
	}
	finding.InspectionID = result.recorded.ID
	finding.SHA256 = result.digests[unit.Entry().ID]
	return finding, s.keepPreviews(ctx, result.recorded, found.contents.Previews)
}
