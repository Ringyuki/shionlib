package character

import "context"

type Repository interface {
	List(ctx context.Context, query string, page Page) ([]Character, int, error)
	Get(ctx context.Context, id int) (Character, error)
	Lock(ctx context.Context, id int) (Character, error)
	HasRelations(ctx context.Context, id int) (bool, error)
	Delete(ctx context.Context, id int) error
}

type AdminStore interface {
	Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
