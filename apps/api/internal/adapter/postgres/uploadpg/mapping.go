package uploadpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
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
		Created:        row.Created,
		Updated:        row.Updated,
	}
}
