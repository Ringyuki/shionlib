package download

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Repository interface {
	ListGameResources(ctx context.Context, gameID int) ([]GameResource, error)
	ListCreditedResources(ctx context.Context, translatorID int) ([]int, error)
	GetGameResource(ctx context.Context, id int, excludeRated bool) (GameResource, error)
	ListReleases(ctx context.Context, excludeRated bool, page Page) ([]Release, int, error)
	ListUserResources(ctx context.Context, creatorID int, filter UserResourceFilter, page Page) ([]UserResource, int, error)
	ListOwnResources(ctx context.Context, creatorID int, query OwnQuery, page Page) ([]GameResource, int, error)
	SummarizeOwnResources(ctx context.Context, creatorID int, recentSince time.Time) (OwnSummary, error)
	HasUploadingSession(ctx context.Context, userID int) (bool, error)
	CreateResource(ctx context.Context, in NewResource) (Resource, error)
	CreateFile(ctx context.Context, in NewFile) (File, error)
	GetResource(ctx context.Context, id int) (Resource, error)
	LockResource(ctx context.Context, id int) (Resource, error)
	UpdateResource(ctx context.Context, id int, changes ResourceChanges) error
	SetForm(ctx context.Context, id int, form Form) error
	SetResourceStatus(ctx context.Context, id, status int, updated time.Time) error
	TouchResource(ctx context.Context, id int, updated time.Time) error
	PublishIfReady(ctx context.Context, id int, at time.Time) (bool, error)
	DeleteResource(ctx context.Context, id int) error
	CountDownload(ctx context.Context, resourceID, gameID int) error
	ListFiles(ctx context.Context, resourceID int) ([]File, error)
	CountFiles(ctx context.Context, resourceID int) (int, error)
	GetFile(ctx context.Context, id int) (File, error)
	GetPublicFile(ctx context.Context, id int) (File, error)
	LockFile(ctx context.Context, id int) (File, error)
	FindFileBySession(ctx context.Context, sessionID int) (File, bool, error)
	ReplaceFileContent(ctx context.Context, id int, content FileContent) error
	MarkFileStored(ctx context.Context, id int, key string) error
	RenameFile(ctx context.Context, id int, name string) error
	ClearFilePath(ctx context.Context, id int) error
	DeleteFile(ctx context.Context, id int) error
	ListUnneededLocalCopies(ctx context.Context, limit int) ([]File, error)
	ListAwaitingStore(ctx context.Context, updatedBefore time.Time, limit int) ([]int, error)
	ListRejected(ctx context.Context, limit int) ([]File, error)
	CreateHistory(ctx context.Context, in NewHistory) error
	LatestHistory(ctx context.Context, fileID int) (History, bool, error)
	SetHistoryStorageKey(ctx context.Context, id int, key string) error
	ListHistory(ctx context.Context, fileID int) ([]HistoryEntry, error)
	GetHistory(ctx context.Context, id int) (History, error)
	SetHistoryReason(ctx context.Context, id int, reason *string) error
	CreateEvent(ctx context.Context, in NewEvent) error
	ListEvents(ctx context.Context, resourceID, limit int) ([]Event, error)
	FavoriteReceivers(ctx context.Context, gameID, excludeUserID int) ([]int, error)
	ResetMalwareStrikes(ctx context.Context, userID int) error
}

type LegacyStore interface {
	ListLegacy(ctx context.Context, afterID, limit int) ([]LegacyResource, error)
	Describe(ctx context.Context, id int, description LegacyDescription) error
}

type GameCards interface {
	Exists(ctx context.Context, id int) (bool, error)
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Media interface {
	Medium(ctx context.Context, inspectionID int) (string, error)
}

type Translators interface {
	Resolve(ctx context.Context, names []string, creatorID int) ([]translator.Ref, error)
}

type Discussions interface {
	CountByResource(ctx context.Context, resourceIDs []int) (map[int]int, error)
}

type Sessions interface {
	Claim(ctx context.Context, who actor.Actor, id int) (upload.Session, error)
}

type Activities interface {
	Record(ctx context.Context, in activity.NewActivity) error
}

type Messenger interface {
	Send(ctx context.Context, in message.NewMessage) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}

type Queue interface {
	Enqueue(ctx context.Context, job Job) error
}

type Job interface {
	Kind() string
}

type ObjectStore interface {
	Put(ctx context.Context, object Object) error
	Delete(ctx context.Context, key string) error
	DeleteVersionsBefore(ctx context.Context, key string, before time.Time) error
	List(ctx context.Context) (Listing, error)
}

type LocalFiles interface {
	Owns(path string) bool
	Exists(ctx context.Context, path string) (bool, error)
	Remove(ctx context.Context, path string) error
}

type Challenge interface {
	Verify(ctx context.Context, token string) (Verdict, error)
}

type Authorizer interface {
	Authorize(ctx context.Context, key string, validFor time.Duration) (Authorization, error)
}

type TicketSealer interface {
	Seal(ticket Ticket) (string, error)
}
