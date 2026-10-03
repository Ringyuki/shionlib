package game

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type Repository interface {
	List(ctx context.Context, filter ListFilter, page Page) ([]int, int, error)
	Listable(ctx context.Context, ids []int, visibility Visibility) ([]int, error)
	CountListable(ctx context.Context, visibility Visibility) (int, error)
	ListableAt(ctx context.Context, visibility Visibility, offset int) (int, bool, error)
	Detail(ctx context.Context, id int) (Detail, error)
	Relations(ctx context.Context, id int) ([]Relation, error)
	IncreaseViews(ctx context.Context, id int) error
}

type RecentUpdates interface {
	Page(ctx context.Context, offset, count int, expiredBefore time.Time) ([]int, int, error)
}

type Preferences interface {
	OnlyGamesWithResources(ctx context.Context, userID int) (bool, error)
}

type CardLookup interface {
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]Card, error)
}

type ExternalIDLookup interface {
	ExternalIDs(ctx context.Context, id int) (ExternalIDs, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
}

type Bangumi interface {
	Subject(ctx context.Context, subjectID string) (BangumiScore, error)
	Resource(ctx context.Context, path string) ([]byte, error)
}

type VNDB interface {
	Rating(ctx context.Context, vndbID string) (VNDBScore, bool, error)
}

type HotScoreStore interface {
	RefreshHotScore(ctx context.Context, weights HotScoreWeights) (int64, error)
}

type AdminStore interface {
	Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error)
	Scalar(ctx context.Context, id int) (Scalar, error)
	Lock(ctx context.Context, id int) error
	SetStatus(ctx context.Context, id int, status Status) error
	UpdateScalar(ctx context.Context, id int, changes ScalarChanges) error
	StorageKeys(ctx context.Context, id int) ([]string, error)
	Delete(ctx context.Context, id int) error
}

type RecentUpdateMarks interface {
	Add(ctx context.Context, gameID int, at time.Time) error
	Remove(ctx context.Context, gameID int) error
}

type CatalogExclusions interface {
	Exclude(ctx context.Context, entity catalog.Entity, localID int) error
}

type ObjectPurger interface {
	PurgeLater(ctx context.Context, keys []string) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
