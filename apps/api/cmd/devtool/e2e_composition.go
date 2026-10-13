package main

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

const (
	e2eComposableGame     = 3
	e2eComposableFolder   = "Game"
	e2eComposableUnpacked = 9_216
)

var e2eComposableResource = e2eSeededResource{
	Platform: []string{"win"},
	Language: []string{"jp"},
}

var e2eComposableFile = e2eSeededFile{
	Type:            1,
	FileName:        "[260101][E2E] E2E 管理临时作品 4 DL版 (files).7z",
	S3FileKey:       e2ePtr("games/e2e/composable/base.7z"),
	FileSize:        6_144,
	FileContentType: "application/x-7z-compressed",
	FileHash:        "e2e-composable-base-hash",
	FileStatus:      3,
	FileCheckStatus: 1,
}

var e2eComposableEntries = []e2eInspectedEntry{
	{Parent: -1, Name: e2eComposableFolder, Kind: inspection.KindFolder, Size: e2eComposableUnpacked, Items: 3, Children: 3},
	{Parent: 0, Position: 0, Name: "data.xp3", Kind: inspection.KindFile, Size: 8_192},
	{Parent: 0, Position: 1, Name: "game.exe", Kind: inspection.KindFile, Size: 512},
	{Parent: 0, Position: 2, Name: "patch.xp3", Kind: inspection.KindFile, Size: 512},
}

func (s *e2eSeeder) seedComposable(ctx context.Context, tx *ent.Client, content e2ePostGameContent) error {
	gameID := content.gameIDs[min(e2eComposableGame, len(content.gameIDs)-1)]
	resourceID, file, err := s.createResource(ctx, tx, gameID, content.adminID, e2eComposableResource, e2eComposableFile)
	if err != nil {
		return err
	}
	err = tx.GameDownloadResource.UpdateOneID(resourceID).
		SetForm(string(download.FormPortable)).
		SetEdition(string(download.EditionDownload)).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("describe the composable resource: %w", err)
	}
	checked := s.now().UTC()
	record, err := tx.Inspection.Create().
		SetResourceID(resourceID).
		SetStatus(string(inspection.StatusReady)).
		SetArchiveFormat("7z").
		SetVolumes(1).
		SetFileCount(len(e2eComposableEntries) - 1).
		SetFolderCount(1).
		SetUnpackedSize(e2eComposableUnpacked).
		SetVerified(true).
		SetScanEngine(e2eScanEngine).
		SetSignaturesAt(checked.Add(-e2eSignatureAge)).
		SetScannedCount(1).
		SetScanLimit(e2eScanLimit).
		SetScannedAt(checked).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("create the inspection of the composable resource: %w", err)
	}
	ids := make([]int, len(e2eComposableEntries))
	for index, entry := range e2eComposableEntries {
		create := tx.InspectionEntry.Create().
			SetInspectionID(record.ID).
			SetPosition(entry.Position).
			SetName(entry.Name).
			SetKind(string(entry.Kind)).
			SetSize(entry.Size).
			SetItems(entry.Items).
			SetChildren(entry.Children)
		if entry.Parent >= 0 {
			create.SetParentID(ids[entry.Parent])
		}
		row, err := create.Save(ctx)
		if err != nil {
			return fmt.Errorf("create the composable entry %s: %w", entry.Name, err)
		}
		ids[index] = row.ID
	}
	return tx.GameDownloadResourceFile.UpdateOneID(file.ID).SetInspectionID(record.ID).Exec(ctx)
}
