package backup

import (
	"context"
	"io"
	"time"
)

type Tier string

const (
	TierDaily  Tier = "daily"
	TierWeekly Tier = "weekly"
)

const (
	ContentType = "application/octet-stream"
	keySuffix   = ".shionlibbackup"
)

func (t Tier) Prefix() string {
	return "backup/database/" + string(t) + "/"
}

type Object struct {
	Key          string
	LastModified time.Time
}

type Retention struct {
	Daily  int
	Weekly int
}

func (r Retention) For(tier Tier) int {
	if tier == TierWeekly {
		return r.Weekly
	}
	return r.Daily
}

type Dumper interface {
	Dump(ctx context.Context) (io.ReadCloser, error)
}

type Store interface {
	Upload(ctx context.Context, key, contentType string, body io.Reader) error
	List(ctx context.Context, prefix string) ([]Object, error)
	Delete(ctx context.Context, key string) error
}
