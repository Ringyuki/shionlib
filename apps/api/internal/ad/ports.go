package ad

import (
	"context"
	"time"
)

type Repository interface {
	Enabled(ctx context.Context, slot Slot) ([]Ad, error)
	Running(ctx context.Context, now time.Time) ([]Ad, error)
	List(ctx context.Context, filter ListFilter, now time.Time, page Page) ([]Ad, int, error)
	Get(ctx context.Context, id int) (Ad, error)
	Create(ctx context.Context, draft Draft) (Ad, error)
	Replace(ctx context.Context, id int, draft Draft) (Ad, error)
	Delete(ctx context.Context, id int) error
	AddViews(ctx context.Context, day time.Time, views map[View]int) error
	AddClick(ctx context.Context, day time.Time, view View) error
	Counts(ctx context.Context, ids []int, from, to time.Time) ([]DailyCount, error)
}

type Sponsors interface {
	IsSponsor(ctx context.Context, userID int, at time.Time) (bool, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	DeletePrefix(ctx context.Context, prefix string) error
}

type ClickGuard interface {
	First(ctx context.Context, key string, window time.Duration) (bool, error)
}
