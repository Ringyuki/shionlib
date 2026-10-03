package catalog

import (
	"context"
	"time"
)

type Source interface {
	Name() string
	Game(ctx context.Context, externalID string) (GameSnapshot, error)
	Developer(ctx context.Context, externalID string) (DeveloperSnapshot, error)
	Character(ctx context.Context, externalID string) (CharacterSnapshot, error)
	SearchGames(ctx context.Context, query string, page, size int) ([]SearchHit, int, error)
}

type ChangeFeed interface {
	Changes(ctx context.Context, cursor string, limit int) (ChangeBatch, error)
}

type Store interface {
	ApplyGame(ctx context.Context, source string, record GameRecord, creatorID int, at time.Time) (int, []Ref, error)
	ApplyDeveloper(ctx context.Context, source string, record DeveloperRecord, at time.Time) (int, error)
	ApplyCharacter(ctx context.Context, source string, record CharacterRecord, at time.Time) (int, error)
	MarkMissing(ctx context.Context, ref Ref, hide bool, at time.Time) error
	Exclude(ctx context.Context, entity Entity, localID int, at time.Time) error
	Include(ctx context.Context, ref Ref) error
	Excluded(ctx context.Context, ref Ref) (bool, error)
	RecordFailure(ctx context.Context, ref Ref, reason string, at time.Time) error
	Stale(ctx context.Context, source string, before time.Time, limit int) ([]Ref, error)
	LocalID(ctx context.Context, ref Ref) (int, bool, error)
	Cursor(ctx context.Context, source string) (string, error)
	SaveCursor(ctx context.Context, source, cursor string) error
}

type Queue interface {
	Enqueue(ctx context.Context, job interface{ Kind() string }) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
