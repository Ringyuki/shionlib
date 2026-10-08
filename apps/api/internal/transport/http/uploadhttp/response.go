package uploadhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type ongoingUploadDTO struct {
	UploadSessionID int                  `json:"upload_session_id"`
	Status          upload.SessionStatus `json:"status" enum:"UPLOADING,COMPLETED" doc:"COMPLETED sessions are finished uploads not yet in a resource"`
	FileName        string               `json:"file_name"`
	TotalSize       int64                `json:"total_size"`
	ChunkSize       int64                `json:"chunk_size"`
	UploadedChunks  []int                `json:"uploaded_chunks"`
	TotalChunks     int                  `json:"total_chunks"`
	ExpiresAt       time.Time            `json:"expires_at"`
	HeldElsewhere   bool                 `json:"held_elsewhere" doc:"Another client has this session in its queue; it cannot be written, completed or aborted from here until that hold runs out"`
}

type uploadHoldDTO struct {
	Held       []int `json:"held" doc:"Sessions this client now holds"`
	Elsewhere  []int `json:"elsewhere" doc:"Sessions another client holds"`
	TTLSeconds int   `json:"ttl_seconds" doc:"How long a hold lasts without being renewed; sessions in neither list are gone"`
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
	FileSHA256     *string              `json:"file_sha256" doc:"BLAKE3 digest of the whole file; null until the upload is completed"`
	TotalSize      int64                `json:"total_size"`
	ChunkSize      int64                `json:"chunk_size"`
	TotalChunks    int                  `json:"total_chunks"`
	ExpiresAt      time.Time            `json:"expires_at"`
}

type uploadCompleteDTO struct {
	OK bool `json:"ok"`
}

type AllowanceDTO struct {
	Tier          upload.Tier `json:"tier" enum:"new,regular,trusted,admin"`
	Approved      int         `json:"approved" doc:"Published resources of the uploader"`
	Trusted       bool        `json:"trusted" doc:"Trusted tier granted by an admin"`
	FrozenUntil   *time.Time  `json:"frozen_until" doc:"Set while a violation keeps the uploader one tier down"`
	Stored        int64       `json:"stored" doc:"Bytes of the uploader's files in active resources and of finished uploads not yet in a resource"`
	StoredLimit   *int64      `json:"stored_limit" doc:"Null when unlimited; counts stored and in-flight bytes"`
	InFlight      int64       `json:"in_flight" doc:"Bytes of uploads in progress"`
	InFlightLimit int64       `json:"in_flight_limit"`
	MaxFileSize   *int64      `json:"max_file_size" doc:"Null when unlimited"`
}

func ToAllowanceDTO(a upload.Allowance) AllowanceDTO {
	return AllowanceDTO{
		Tier:          a.Tier,
		Approved:      a.Approved,
		Trusted:       a.Trusted,
		FrozenUntil:   a.FrozenUntil,
		Stored:        a.Stored,
		StoredLimit:   a.StoredLimit,
		InFlight:      a.InFlight,
		InFlightLimit: a.InFlightLimit,
		MaxFileSize:   a.MaxFileSize,
	}
}

func toOngoingUpload(s upload.OngoingSession) ongoingUploadDTO {
	chunks := s.UploadedChunks
	if chunks == nil {
		chunks = []int{}
	}
	return ongoingUploadDTO{
		UploadSessionID: s.ID,
		Status:          s.Status,
		FileName:        s.FileName,
		TotalSize:       s.TotalSize,
		ChunkSize:       s.ChunkSize,
		UploadedChunks:  chunks,
		TotalChunks:     s.TotalChunks,
		ExpiresAt:       s.ExpiresAt,
		HeldElsewhere:   s.HeldElsewhere,
	}
}

func toUploadStatus(s upload.Session) uploadStatusDTO {
	var digest *string
	if s.FileHash != "" {
		digest = &s.FileHash
	}
	return uploadStatusDTO{
		Status:         s.Status,
		UploadedChunks: s.SortedChunks(),
		FileSHA256:     digest,
		TotalSize:      s.TotalSize,
		ChunkSize:      s.ChunkSize,
		TotalChunks:    s.TotalChunks,
		ExpiresAt:      s.ExpiresAt,
	}
}
