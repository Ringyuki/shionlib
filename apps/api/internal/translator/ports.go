package translator

import "context"

type Repository interface {
	Get(ctx context.Context, id int) (Translator, error)
	Lock(ctx context.Context, id int) (Translator, error)
	FindByKeys(ctx context.Context, keys []string) ([]Translator, error)
	Ensure(ctx context.Context, in NewTranslator) (Translator, error)
	Update(ctx context.Context, id int, changes Changes) error
	Delete(ctx context.Context, id int) error
	List(ctx context.Context, query string, page Page) ([]Summary, int, error)
	Suggest(ctx context.Context, query string, limit int) ([]Summary, error)
	CountWorks(ctx context.Context, id int) (int, error)
	Reassign(ctx context.Context, fromID, toID int) error
}

type AdminStore interface {
	Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error)
	Scan(ctx context.Context, limit int) ([]AdminEntry, error)
	Distinctions(ctx context.Context) ([]Distinction, error)
	AddDistinctions(ctx context.Context, pairs []Distinction) error
}

type Followers interface {
	TranslatorChanged(ctx context.Context, id int) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
