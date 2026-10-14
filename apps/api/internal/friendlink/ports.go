package friendlink

import "context"

type Repository interface {
	List(ctx context.Context, visibleOnly bool) ([]Link, error)
	Get(ctx context.Context, id int) (Link, error)
	Create(ctx context.Context, in NewLink, position int) (Link, error)
	Update(ctx context.Context, id int, changes Changes) (Link, error)
	Delete(ctx context.Context, id int) error
	LastPosition(ctx context.Context) (int, error)
	SetPosition(ctx context.Context, id, position int) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
