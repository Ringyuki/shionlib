package moderation

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Repository interface {
	CommentSubject(ctx context.Context, id int) (CommentSubject, error)
	LockCommentSubject(ctx context.Context, id int) (CommentSubject, error)
	ApproveComment(ctx context.Context, id int) error
	BlockComment(ctx context.Context, id int) error
	WalkthroughSubject(ctx context.Context, id int) (WalkthroughSubject, error)
	LockWalkthroughSubject(ctx context.Context, id int) (WalkthroughSubject, error)
	PublishWalkthrough(ctx context.Context, id int) error
	HideWalkthrough(ctx context.Context, id int) error
	PendingWalkthroughReviews(ctx context.Context, updatedBefore time.Time, limit int) ([]int, error)
	PendingComments(ctx context.Context, updatedBefore time.Time, limit int) ([]int, error)
	RecordEvent(ctx context.Context, in NewEvent) error
}

type Classifier interface {
	Screen(ctx context.Context, text string) (Screening, error)
	Review(ctx context.Context, request ReviewRequest) (Verdict, error)
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
