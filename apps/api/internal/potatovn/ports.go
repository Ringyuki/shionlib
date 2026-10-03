package potatovn

import (
	"context"
	"time"
)

type Repository interface {
	Binding(ctx context.Context, userID int) (Binding, error)
	CreateBinding(ctx context.Context, in NewBinding) (Binding, error)
	DeleteBinding(ctx context.Context, userID int) error
	UpdateToken(ctx context.Context, userID int, token string, expires time.Time) error
	BindingsExpiringBefore(ctx context.Context, at time.Time) ([]int, error)
	BindingUserIDs(ctx context.Context, afterUserID, limit int) ([]int, error)
	DeleteExpiredBindings(ctx context.Context, now time.Time) (int, error)
	Mapping(ctx context.Context, userID, gameID int) (Mapping, error)
	CreateMapping(ctx context.Context, in NewMapping) (Mapping, error)
	SyncMapping(ctx context.Context, in NewMapping) error
	DeleteMapping(ctx context.Context, userID, gameID int) error
	DeleteMappings(ctx context.Context, userID int) error
}

type Catalog interface {
	GameInfo(ctx context.Context, gameID int) (GameInfo, error)
	MatchGame(ctx context.Context, bangumiID, vndbID *string) (int, bool, error)
}

type Client interface {
	Login(ctx context.Context, userName, password string) (Session, error)
	Refresh(ctx context.Context, token string) (Session, error)
	Library(ctx context.Context, token string, pageIndex, pageSize int) (LibraryPage, error)
	SaveGalgame(ctx context.Context, token string, draft GalgameDraft) (Galgame, error)
	RemoveGalgame(ctx context.Context, token string, galgameID int) error
	ReserveImage(ctx context.Context, token, objectName string, size int) (string, error)
	UploadImage(ctx context.Context, uploadURL string, cover Cover) error
	CommitImage(ctx context.Context, token, objectName string) error
}

type Covers interface {
	Fetch(ctx context.Context, key string, maxBytes int64) (Cover, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type ScheduleSync func(ctx context.Context, job SyncLibraryJob) error
