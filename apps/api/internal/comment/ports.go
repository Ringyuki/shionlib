package comment

import (
	"context"
	"encoding/json"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Repository interface {
	Get(ctx context.Context, id int) (Comment, error)
	Lock(ctx context.Context, id int) (Comment, error)
	Create(ctx context.Context, in NewComment) (Comment, error)
	SetRoot(ctx context.Context, id, rootID int) error
	AdjustReplyCount(ctx context.Context, id, delta int) error
	UpdateContent(ctx context.Context, id int, content json.RawMessage, html string) error
	SetStatus(ctx context.Context, id int, status Status) error
	Delete(ctx context.Context, id int) error
	Entry(ctx context.Context, id, viewerID int) (Entry, error)
	ListByGame(ctx context.Context, gameID, viewerID int, page Page) ([]Entry, int, error)
	ListByCreator(ctx context.Context, filter CreatorFilter, page Page) ([]Entry, int, error)
	HasLike(ctx context.Context, commentID, userID int) (bool, error)
	AddLike(ctx context.Context, commentID, userID int) (bool, error)
	RemoveLike(ctx context.Context, commentID, userID int) error
}

type AdminStore interface {
	Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error)
	Detail(ctx context.Context, id int) (AdminDetail, error)
	HasActivity(ctx context.Context, commentID int) (bool, error)
	HasReplyNotice(ctx context.Context, commentID, receiverID int) (bool, error)
}

type GameCards interface {
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Messages interface {
	Send(ctx context.Context, in message.NewMessage) error
}

type Activities interface {
	Record(ctx context.Context, in activity.NewActivity) error
}

type Job = interface{ Kind() string }

type Queue interface {
	Enqueue(ctx context.Context, job Job) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
