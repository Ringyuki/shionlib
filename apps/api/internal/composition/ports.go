package composition

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Repository interface {
	Create(ctx context.Context, in NewComposition) (Composition, error)
	Get(ctx context.Context, id int) (Composition, error)
	Lock(ctx context.Context, id int) (Composition, error)
	LockQueue(ctx context.Context) error
	Save(ctx context.Context, composition Composition) error
	SetProgress(ctx context.Context, id int, percent int) error
	SetEntries(ctx context.Context, id int, role Role, entries []Entry) error
	Entries(ctx context.Context, id int, role Role) ([]Entry, error)
	Delete(ctx context.Context, id int) error
	ListActive(ctx context.Context, creatorID, limit int) ([]Composition, error)
	OfResource(ctx context.Context, resourceID int) ([]Composition, error)
	Composed(ctx context.Context, resourceIDs []int) ([]int, error)
	CountQueued(ctx context.Context) (int, error)
	CountRunning(ctx context.Context) (int, error)
	Ahead(ctx context.Context, id int) (int, error)
	StaleDrafts(ctx context.Context, before time.Time, limit int) ([]int, error)
	Existing(ctx context.Context, ids []int) ([]int, error)
	Unsettled(ctx context.Context, limit int) ([]Composition, error)
}

type Bases interface {
	OfGame(ctx context.Context, viewer actor.Actor, gameID int) ([]download.GameResource, error)
	Stored(ctx context.Context, resourceID int) (download.GameResource, error)
}

type Listings interface {
	Facts(ctx context.Context, ids []int) (map[int]inspection.Inspection, error)
	Files(ctx context.Context, inspectionID int) ([]inspection.FilePath, error)
}

type Uploads interface {
	Take(ctx context.Context, who actor.Actor, sessionID int, target string, compositionID int) (upload.Session, error)
}

type Quota interface {
	Allowance(ctx context.Context, userID int) (upload.Allowance, error)
}

type Spool interface {
	SpoolRoom(ctx context.Context) (int64, error)
}

type Examiner interface {
	Checking() bool
	Examine(ctx context.Context, file scan.LocalFile, record bool) (scan.LocalFinding, error)
}

type Resources interface {
	Begin(ctx context.Context, who actor.Actor, draft download.ComposedDraft) (download.Resource, error)
	Owned(ctx context.Context, who actor.Actor, resourceID int) (download.GameResource, error)
	Publish(ctx context.Context, file download.ComposedFile) error
	Replace(ctx context.Context, file download.ComposedReplacement) error
	Discard(ctx context.Context, resourceID int) error
}

type Names interface {
	Preview(ctx context.Context, in download.NamePreview) (download.FileName, error)
}

type Games interface {
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Patches interface {
	ByHash(ctx context.Context, viewer actor.Actor, gameID int, sha256 string) (moyu.Entry, bool, error)
}

type Objects interface {
	Download(ctx context.Context, key, path string, observe func(done int64)) error
}

type Archiver interface {
	Unpack(ctx context.Context, in Unpacking, observe func(percent int)) error
	Pack(ctx context.Context, in Packing, observe func(percent int)) error
}

type Stage interface {
	Open(ctx context.Context, id int) (string, error)
	Clear(ctx context.Context, dir string) error
	Discard(ctx context.Context, dir string) error
	Tree(ctx context.Context, dir string) ([]Node, error)
	Sweep(ctx context.Context, dir, encoding string) error
	Move(ctx context.Context, source, target string) error
	Link(ctx context.Context, source, target string) error
	Remove(ctx context.Context, path string) error
	Size(ctx context.Context, path string) (int64, error)
	Dirs(ctx context.Context) ([]int, error)
}

type Messenger interface {
	Send(ctx context.Context, in message.NewMessage) error
}

type Queue interface {
	Enqueue(ctx context.Context, job Job) error
}

type Job interface {
	Kind() string
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}
