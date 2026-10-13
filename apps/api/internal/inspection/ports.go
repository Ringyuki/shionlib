package inspection

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Repository interface {
	Create(ctx context.Context, in NewInspection) (int, error)
	AddEntries(ctx context.Context, inspectionID int, entries []NewEntry) ([]int, error)
	SetPreview(ctx context.Context, entryID int, preview Preview) error
	Get(ctx context.Context, id int) (Inspection, error)
	ByIDs(ctx context.Context, ids []int) ([]Inspection, error)
	Discs(ctx context.Context, inspectionIDs []int) ([]Entry, error)
	MediumNames(ctx context.Context, inspectionID int) ([]string, error)
	FilePaths(ctx context.Context, inspectionID int) ([]FilePath, error)
	Children(ctx context.Context, inspectionID int, parentID *int, page Page) ([]Entry, int, error)
	Search(ctx context.Context, inspectionID int, query string, page Page) ([]Found, int, error)
	GetEntry(ctx context.Context, id int) (Entry, error)
	MarkCleared(ctx context.Context, ids []int, at time.Time) error
	Orphans(ctx context.Context, before time.Time, limit int) ([]int, error)
	PreviewEntries(ctx context.Context, inspectionID int) ([]int, error)
	Delete(ctx context.Context, id int) error
}

type Resources interface {
	Inspections(ctx context.Context, viewer actor.Actor, resourceID int) ([]int, error)
}

type PreviewStore interface {
	PutBytes(ctx context.Context, key string, data []byte, contentType string, metadata map[string]string) error
	GetBytes(ctx context.Context, key string, limit int64) ([]byte, error)
	Delete(ctx context.Context, key string) error
}

type ImageShrinker interface {
	Shrink(ctx context.Context, data []byte, longest int) ([]byte, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
