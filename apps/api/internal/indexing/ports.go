package indexing

import (
	"context"
	"time"
)

type ChangeFeed interface {
	Changes(ctx context.Context, since time.Time, limit int) ([]Change, error)
}

type Submitter interface {
	Submit(ctx context.Context, urls []string) error
}

type Cursor interface {
	Load(ctx context.Context) (time.Time, bool, error)
	Save(ctx context.Context, at time.Time) error
}
