package uploadhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type ongoingUploadDTO struct {
	UploadSessionID int       `json:"upload_session_id"`
	FileName        string    `json:"file_name"`
	FileSHA256      string    `json:"file_sha256"`
	TotalSize       int64     `json:"total_size"`
	ChunkSize       int64     `json:"chunk_size"`
	UploadedChunks  []int     `json:"uploaded_chunks"`
	TotalChunks     int       `json:"total_chunks"`
	ExpiresAt       time.Time `json:"expires_at"`
}

type initUploadDTO struct {
	UploadSessionID int       `json:"upload_session_id"`
	ChunkSize       int64     `json:"chunk_size"`
	TotalChunks     int       `json:"total_chunks"`
	ExpiresAt       time.Time `json:"expires_at"`
}

type uploadChunkDTO struct {
	OK         bool `json:"ok"`
	ChunkIndex int  `json:"chunk_index"`
}

type uploadStatusDTO struct {
	Status         upload.SessionStatus `json:"status" enum:"UPLOADING,COMPLETED,ABORTED,EXPIRED"`
	UploadedChunks []int                `json:"uploaded_chunks"`
	FileSHA256     string               `json:"file_sha256"`
	TotalSize      int64                `json:"total_size"`
	ChunkSize      int64                `json:"chunk_size"`
	TotalChunks    int                  `json:"total_chunks"`
	ExpiresAt      time.Time            `json:"expires_at"`
}

type uploadCompleteDTO struct {
	OK bool `json:"ok"`
}

type uploadQuotaDTO struct {
	Size int64 `json:"size"`
	Used int64 `json:"used"`
}

func toOngoingUpload(s upload.Session) ongoingUploadDTO {
	chunks := s.UploadedChunks
	if chunks == nil {
		chunks = []int{}
	}
	return ongoingUploadDTO{
		UploadSessionID: s.ID,
		FileName:        s.FileName,
		FileSHA256:      s.FileHash,
		TotalSize:       s.TotalSize,
		ChunkSize:       s.ChunkSize,
		UploadedChunks:  chunks,
		TotalChunks:     s.TotalChunks,
		ExpiresAt:       s.ExpiresAt,
	}
}

func toUploadStatus(s upload.Session) uploadStatusDTO {
	return uploadStatusDTO{
		Status:         s.Status,
		UploadedChunks: s.SortedChunks(),
		FileSHA256:     s.FileHash,
		TotalSize:      s.TotalSize,
		ChunkSize:      s.ChunkSize,
		TotalChunks:    s.TotalChunks,
		ExpiresAt:      s.ExpiresAt,
	}
}
