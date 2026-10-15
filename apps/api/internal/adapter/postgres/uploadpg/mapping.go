package uploadpg

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func toSessions(rows []*ent.GameUploadSession) []upload.Session {
	sessions := make([]upload.Session, len(rows))
	for i, row := range rows {
		sessions[i] = toSession(row)
	}
	return sessions
}

func toSession(row *ent.GameUploadSession) upload.Session {
	chunks := []int(row.UploadedChunks)
	if chunks == nil {
		chunks = []int{}
	}
	return upload.Session{
		ID:             row.ID,
		FileName:       row.FileName,
		MimeType:       row.MimeType,
		TotalSize:      row.TotalSize,
		ChunkSize:      int64(row.ChunkSize),
		TotalChunks:    row.TotalChunks,
		UploadedChunks: chunks,
		HashAlgorithm:  upload.HashAlgorithm(row.HashAlgorithm),
		FileHash:       row.FileSha256,
		Status:         upload.SessionStatus(row.Status),
		StoragePath:    row.StoragePath,
		ExpiresAt:      row.ExpiresAt,
		CreatorID:      row.CreatorID,
		LastChunkAt:    row.LastChunkAt,
		CompletedAt:    row.CompletedAt,
		SubmittedAt:    row.SubmittedAt,
		AbortedAt:      row.AbortedAt,
		EndedAt:        row.EndedAt,
		Created:        row.Created,
		Updated:        row.Updated,
	}
}

type rowScanner interface {
	Scan(dest ...any) error
}

type uploadRow struct {
	kind, fileName, userName                                                      string
	id, userID                                                                    int
	started                                                                       time.Time
	size                                                                          int64
	status, hashAlgorithm, fileHash, fileLabel, titleJP, titleZH, titleEN         sql.NullString
	chunkSize, totalChunks, fileID, fileType, fileStatus, checkStatus, inspection sql.NullInt64
	resourceID, resourceStatus, gameID                                            sql.NullInt64
	received                                                                      pgvalue.Ints
	failures, total                                                               int
	expiresAt, lastChunkAt, completedAt, submittedAt, abortedAt, endedAt, updated sql.NullTime
	publishedAt                                                                   sql.NullTime
}

func scanUpload(scanner rowScanner) (download.Upload, int, error) {
	var r uploadRow
	err := scanner.Scan(&r.kind, &r.id, &r.started, &r.userID, &r.userName, &r.fileName, &r.size, &r.status, &r.chunkSize, &r.totalChunks,
		&r.received, &r.hashAlgorithm, &r.fileHash, &r.expiresAt, &r.lastChunkAt, &r.completedAt, &r.submittedAt,
		&r.abortedAt, &r.endedAt, &r.updated, &r.fileID, &r.fileType, &r.fileStatus, &r.checkStatus,
		&r.inspection, &r.fileLabel, &r.resourceID, &r.resourceStatus, &r.publishedAt, &r.gameID,
		&r.titleJP, &r.titleZH, &r.titleEN, &r.failures, &r.total)
	if err != nil {
		return download.Upload{}, 0, fmt.Errorf("scan an upload: %w", err)
	}
	entry := download.Upload{
		Kind:         download.UploadKind(r.kind),
		ID:           r.id,
		FileName:     r.fileName,
		Size:         r.size,
		UserID:       r.userID,
		UserName:     r.userName,
		FailureCount: r.failures,
		Started:      r.started,
	}
	if entry.Kind == download.UploadSession {
		entry.Session = &upload.Session{
			ID:             r.id,
			FileName:       r.fileName,
			TotalSize:      r.size,
			ChunkSize:      r.chunkSize.Int64,
			TotalChunks:    int(r.totalChunks.Int64),
			UploadedChunks: chunksOf(r.received),
			HashAlgorithm:  upload.HashAlgorithm(r.hashAlgorithm.String),
			FileHash:       r.fileHash.String,
			Status:         upload.SessionStatus(r.status.String),
			ExpiresAt:      r.expiresAt.Time,
			CreatorID:      r.userID,
			LastChunkAt:    timeOf(r.lastChunkAt),
			CompletedAt:    timeOf(r.completedAt),
			SubmittedAt:    timeOf(r.submittedAt),
			AbortedAt:      timeOf(r.abortedAt),
			EndedAt:        timeOf(r.endedAt),
			Created:        r.started,
			Updated:        r.updated.Time,
		}
	}
	if r.fileID.Valid {
		var inspection *int
		if r.inspection.Valid {
			id := int(r.inspection.Int64)
			inspection = &id
		}
		entry.Target = &download.UploadTarget{
			FileID:              int(r.fileID.Int64),
			ResourceID:          int(r.resourceID.Int64),
			ResourceStatus:      int(r.resourceStatus.Int64),
			ResourcePublishedAt: timeOf(r.publishedAt),
			File: download.File{
				ID:           int(r.fileID.Int64),
				ResourceID:   int(r.resourceID.Int64),
				GameID:       int(r.gameID.Int64),
				Type:         int(r.fileType.Int64),
				Name:         r.fileLabel.String,
				Status:       int(r.fileStatus.Int64),
				CheckStatus:  download.CheckStatus(r.checkStatus.Int64),
				InspectionID: inspection,
			},
			Game: download.UploadGame{ID: int(r.gameID.Int64), TitleJP: r.titleJP.String, TitleZH: r.titleZH.String, TitleEN: r.titleEN.String},
		}
	}
	return entry, r.total, nil
}

func chunksOf(chunks pgvalue.Ints) []int {
	if chunks == nil {
		return []int{}
	}
	return []int(chunks)
}

func timeOf(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	at := value.Time
	return &at
}

func toFailure(row *ent.UploadFailure) (upload.Failure, error) {
	var recorded []failureAttemptRecord
	if len(row.Attempts) > 0 {
		if err := json.Unmarshal(row.Attempts, &recorded); err != nil {
			return upload.Failure{}, fmt.Errorf("decode the attempts of upload failure %d: %w", row.ID, err)
		}
	}
	attempts := make([]upload.FailureAttempt, len(recorded))
	for i, attempt := range recorded {
		attempts[i] = upload.FailureAttempt{At: attempt.At, Wait: attempt.Wait, Error: attempt.Error.clientError()}
	}
	return upload.Failure{
		ID:     row.ID,
		UserID: row.UserID,
		At:     row.Created,
		FailureReport: upload.FailureReport{
			SessionID: row.SessionID,
			Stage:     upload.FailureStage(row.Stage),
			Reason:    row.Reason,
			Error:     upload.ClientError{Name: row.ErrorName, Message: row.ErrorMessage, Status: row.Status, Code: row.Code, RequestID: row.RequestID, Ray: row.Ray},
			Chunk:     row.Chunk,
			FileName:  row.FileName,
			FileSize:  row.FileSize,
			Attempts:  attempts,
			Client:    row.Client,
			IP:        row.IP,
			UserAgent: row.UserAgent,
		},
	}, nil
}

func (r clientErrorRecord) clientError() upload.ClientError {
	return upload.ClientError{Name: r.Name, Message: r.Message, Status: r.Status, Code: r.Code, RequestID: r.RequestID, Ray: r.Ray}
}
