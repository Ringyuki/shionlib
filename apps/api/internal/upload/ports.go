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
	ListUploading(ctx context.Context, creatorID int, now time.Time, limit int) ([]Session, error)
	AddChunk(ctx context.Context, id, index int) error
	SetStatus(ctx context.Context, id int, from, to SessionStatus, mimeType *string) (bool, error)
	ListStale(ctx context.Context, before time.Time, limit int) ([]Session, error)
	HasFile(ctx context.Context, sessionID int) (bool, error)
	ReferencedPaths(ctx context.Context, paths []string) (map[string]bool, error)
}

type QuotaRepository interface {
	FindQuota(ctx context.Context, userID int) (Quota, bool, error)
	LockQuota(ctx context.Context, userID int) (Quota, error)
	AddRecord(ctx context.Context, in NewQuotaRecord) error
	AddUsed(ctx context.Context, quotaID int, delta int64) error
	AddSize(ctx context.Context, quotaID int, delta int64) error
	SetUsed(ctx context.Context, quotaID int, used int64) error
	MarkFirstGrant(ctx context.Context, quotaID int) error
	FindWithdrawable(ctx context.Context, userID, sessionID int) (QuotaRecord, bool, error)
	MarkWithdrawn(ctx context.Context, recordID int) error
	CountApprovedFiles(ctx context.Context, userID int, since time.Time) (int, error)
	GrantCandidates(ctx context.Context, registeredBefore time.Time, afterID, limit int) ([]int, error)
	ActiveUploaders(ctx context.Context, afterID, limit int) ([]int, error)
	InactiveUploaders(ctx context.Context, lastSeenBefore time.Time, afterID, limit int) ([]int, error)
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
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}
