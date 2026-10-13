package ad

import (
	"context"
	"time"
)

type Repository interface {
	Active(ctx context.Context, placement string, at time.Time) ([]Ad, error)
	List(ctx context.Context, filter ListFilter, page Page) ([]Ad, int, error)
	Get(ctx context.Context, id int) (Ad, error)
	Create(ctx context.Context, in NewAd) (Ad, error)
	Update(ctx context.Context, id int, changes Changes) (Ad, error)
	Delete(ctx context.Context, id int) error
}

type Sponsors interface {
	IsSponsor(ctx context.Context, userID int, at time.Time) (bool, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	DeletePrefix(ctx context.Context, prefix string) error
}
