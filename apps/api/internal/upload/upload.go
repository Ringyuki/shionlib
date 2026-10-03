package upload

import (
	"slices"
	"time"
)

type SessionStatus string

const (
	StatusUploading SessionStatus = "UPLOADING"
	StatusCompleted SessionStatus = "COMPLETED"
	StatusAborted   SessionStatus = "ABORTED"
	StatusExpired   SessionStatus = "EXPIRED"
)

type HashAlgorithm string

const (
	HashSHA256 HashAlgorithm = "sha256"
	HashBLAKE3 HashAlgorithm = "blake3"
)

const (
	DefaultMimeType     = "application/octet-stream"
	PendingStorageName  = "PENDING"
	ReasonGameUpload    = "GAME_UPLOAD"
	staleSessionGrace   = 6 * time.Hour
	orphanFileTTL       = 48 * time.Hour
	staleSessionBatch   = 200
	ongoingSessionLimit = 100
)

type Session struct {
	ID             int
	FileName       string
	MimeType       *string
	TotalSize      int64
	ChunkSize      int64
	TotalChunks    int
	UploadedChunks []int
	HashAlgorithm  HashAlgorithm
	FileHash       string
	Status         SessionStatus
	StoragePath    string
	ExpiresAt      time.Time
	CreatorID      int
	Created        time.Time
	Updated        time.Time
}

func (s Session) Expired(now time.Time) bool {
	return s.ExpiresAt.Before(now)
}

func (s Session) ChunkOffset(index int) int64 {
	return int64(index) * s.ChunkSize
}

func (s Session) ChunkLength(index int) int64 {
	if index == s.TotalChunks-1 {
		return s.TotalSize - int64(s.TotalChunks-1)*s.ChunkSize
	}
	return s.ChunkSize
}

func (s Session) HasChunk(index int) bool {
	return slices.Contains(s.UploadedChunks, index)
}

func (s Session) SortedChunks() []int {
	sorted := slices.Clone(s.UploadedChunks)
	if sorted == nil {
		return []int{}
	}
	slices.Sort(sorted)
	return sorted
}

func (s Session) ReceivedChunks() int {
	return len(slices.Compact(s.SortedChunks()))
}

type NewSession struct {
	FileName    string
	TotalSize   int64
	ChunkSize   int64
	TotalChunks int
	FileHash    string
	StoragePath string
	ExpiresAt   time.Time
	CreatorID   int
}

type InitInput struct {
	FileName  string
	TotalSize int64
	ChunkSize *int64
	FileHash  string
}

type Chunk struct {
	SHA256        string
	ContentLength int64
}
