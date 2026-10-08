package upload

import (
	"context"
	"io"
	"time"
)

type Repository interface {
	CreateSession(ctx context.Context, in NewSession) (Session, error)
	SetStoragePath(ctx context.Context, id int, path string) error
	GetSession(ctx context.Context, id int) (Session, error)
	LockSession(ctx context.Context, id int) (Session, error)
	ListOngoing(ctx context.Context, creatorID int, now time.Time, limit int) ([]Session, error)
	AddChunk(ctx context.Context, id, index int, expiresAt time.Time) error
	SetStatus(ctx context.Context, id int, from, to SessionStatus) (bool, error)
	Complete(ctx context.Context, id int, hash, mimeType string) (bool, error)
	ListStale(ctx context.Context, now, before time.Time, limit int) ([]Session, error)
	HasFile(ctx context.Context, sessionID int) (bool, error)
	HasLiveUpload(ctx context.Context, creatorID int, now time.Time) (bool, error)
	ReferencedPaths(ctx context.Context, paths []string) (map[string]bool, error)
	PendingBytes(ctx context.Context, now time.Time) (int64, error)
	LockAdmission(ctx context.Context) error
}

type Holds interface {
	Hold(ctx context.Context, sessionID int, holder string, ttl time.Duration) (bool, error)
	Holders(ctx context.Context, sessionIDs []int) (map[int]string, error)
}

type QuotaRepository interface {
	Standing(ctx context.Context, userID int) (Standing, error)
	StoredBytes(ctx context.Context, userID int) (int64, error)
	InFlightBytes(ctx context.Context, userID int, now time.Time) (int64, error)
	SetTrusted(ctx context.Context, userID int, trusted bool) error
}

type Spool interface {
	Path(name string) string
	Owns(path string) bool
	Allocate(ctx context.Context, path string, size int64) error
	Write(ctx context.Context, path string, offset int64, body io.Reader, length int64) (string, error)
	DigestRange(ctx context.Context, path string, offset, length int64) (string, error)
	Digest(ctx context.Context, path string) (string, error)
	Remove(ctx context.Context, path string) error
	Stale(ctx context.Context, before time.Time) ([]string, error)
	Available(ctx context.Context) (int64, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}
