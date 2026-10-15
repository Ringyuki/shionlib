package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
)

const (
	e2eUploadingFile   = "e2e-uploading.7z"
	e2eUnreadableFile  = "e2e-unreadable.7z"
	e2eUploadChunk     = 4 << 20
	e2eUploadRay       = "8f3c2a1b9d7e4c21-HKG"
	e2eUploadClient    = "e2e0c41e"
	e2eUploadIP        = "2409:8a55:3c21::1"
	e2eUploadUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0"
)

type e2eUploadAttempt struct {
	At    time.Time      `json:"at"`
	Wait  string         `json:"wait"`
	Error map[string]any `json:"error"`
}

func (s *e2eSeeder) seedUploads(ctx context.Context, tx *ent.Client, uploaderID int, published *ent.GameDownloadResourceFile) error {
	now := s.now().UTC()
	uploading, err := tx.GameUploadSession.Create().
		SetFileName(e2eUploadingFile).
		SetTotalSize(5 * e2eUploadChunk).
		SetChunkSize(e2eUploadChunk).
		SetTotalChunks(5).
		SetUploadedChunks(pgvalue.Ints{0, 1}).
		SetHashAlgorithm(gameuploadsession.HashAlgorithmBlake3).
		SetFileSha256("").
		SetStatus(gameuploadsession.StatusUPLOADING).
		SetStoragePath("/nonexistent/e2e-uploading.part").
		SetExpiresAt(now.Add(24 * time.Hour)).
		SetCreatorID(uploaderID).
		SetLastChunkAt(now.Add(-time.Minute)).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("create the upload in progress: %w", err)
	}
	attempts, err := json.Marshal([]e2eUploadAttempt{{At: now.Add(-2 * time.Minute), Wait: "network", Error: map[string]any{"name": "TypeError", "message": "Failed to fetch"}}})
	if err != nil {
		return fmt.Errorf("encode the attempts of the seeded failure: %w", err)
	}
	err = tx.UploadFailure.Create().
		SetUserID(uploaderID).
		SetSessionID(uploading.ID).
		SetStage("chunk").
		SetReason("rejected").
		SetErrorName("ApiError").
		SetErrorMessage("").
		SetStatus(403).
		SetRay(e2eUploadRay).
		SetChunk(2).
		SetFileName(e2eUploadingFile).
		SetFileSize(5 * e2eUploadChunk).
		SetAttempts(attempts).
		SetClient(e2eUploadClient).
		SetIP(e2eUploadIP).
		SetUserAgent(e2eUploadUserAgent).
		SetCreated(now.Add(-time.Minute)).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("create the failure of the upload in progress: %w", err)
	}
	submitted, err := tx.GameUploadSession.Create().
		SetFileName(published.FileName).
		SetTotalSize(published.FileSize).
		SetChunkSize(e2eUploadChunk).
		SetTotalChunks(1).
		SetUploadedChunks(pgvalue.Ints{0}).
		SetFileSha256(published.FileHash).
		SetStatus(gameuploadsession.StatusCOMPLETED).
		SetStoragePath("/nonexistent/e2e-published.part").
		SetExpiresAt(now.Add(-time.Hour)).
		SetCreatorID(published.CreatorID).
		SetCompletedAt(now.Add(-2 * time.Hour)).
		SetSubmittedAt(now.Add(-2 * time.Hour)).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("create the published upload: %w", err)
	}
	if err := tx.GameDownloadResourceFile.UpdateOneID(published.ID).SetUploadSessionID(submitted.ID).Exec(ctx); err != nil {
		return fmt.Errorf("link the published upload to its file: %w", err)
	}
	err = tx.UploadFailure.Create().
		SetUserID(uploaderID).
		SetStage("read").
		SetReason("unreadable").
		SetErrorName("NotReadableError").
		SetErrorMessage("The requested file could not be read.").
		SetFileName(e2eUnreadableFile).
		SetFileSize(3 * e2eUploadChunk).
		SetAttempts(json.RawMessage(`[]`)).
		SetClient(e2eUploadClient).
		SetIP(e2eUploadIP).
		SetUserAgent(e2eUploadUserAgent).
		SetCreated(now.Add(-30 * time.Second)).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("create the failure before an upload opened: %w", err)
	}
	return nil
}
