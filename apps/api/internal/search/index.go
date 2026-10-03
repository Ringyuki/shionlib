package search

import (
	"context"
	"slices"
	"time"
)

const (
	IndexJobKind     = "search_index"
	rebuildBatchSize = 500
)

type Document struct {
	ID                int
	TitleJP           string
	TitleZH           string
	TitleEN           string
	IntroJP           string
	IntroZH           string
	IntroEN           string
	Aliases           []string
	Tags              []string
	Platform          []string
	NSFW              bool
	MaxCoverSexual    int
	ReleaseDate       *time.Time
	Developers        []DocumentDeveloper
	CharacterActors   []string
	CharacterNamesJP  []string
	CharacterNamesZH  []string
	CharacterNamesEN  []string
	CharacterAliases  []string
	CharacterIntrosJP []string
	CharacterIntrosZH []string
	CharacterIntrosEN []string
	Staffs            []DocumentStaff
}

type DocumentDeveloper struct {
	ID      int
	Name    string
	Role    *string
	Aliases []string
}

type DocumentStaff struct {
	Name string
	Role string
}

type DocumentSource interface {
	Documents(ctx context.Context, ids []int) ([]Document, error)
	DocumentIDs(ctx context.Context, afterID, limit int) ([]int, error)
}

type Index interface {
	Configure(ctx context.Context) error
	Upsert(ctx context.Context, docs []Document) error
	Delete(ctx context.Context, ids []int) error
	Clear(ctx context.Context) error
}

type IndexQueue interface {
	Enqueue(ctx context.Context, job IndexJob) error
}

type IndexJob struct {
	GameIDs []int `json:"game_ids"`
}

func (IndexJob) Kind() string {
	return IndexJobKind
}

type Indexer struct {
	source DocumentSource
	index  Index
	queue  IndexQueue
}

func NewIndexer(source DocumentSource, index Index, queue IndexQueue) *Indexer {
	return &Indexer{source: source, index: index, queue: queue}
}

func (i *Indexer) Enabled() bool {
	return i != nil && i.index != nil
}

func (i *Indexer) GamesChanged(ctx context.Context, ids []int) error {
	ids = normalizeIDs(ids)
	if !i.Enabled() || len(ids) == 0 {
		return nil
	}
	return i.queue.Enqueue(ctx, IndexJob{GameIDs: ids})
}

func (i *Indexer) Refresh(ctx context.Context, ids []int) error {
	ids = normalizeIDs(ids)
	if !i.Enabled() || len(ids) == 0 {
		return nil
	}
	docs, err := i.source.Documents(ctx, ids)
	if err != nil {
		return err
	}
	found := make(map[int]bool, len(docs))
	for _, doc := range docs {
		found[doc.ID] = true
	}
	var gone []int
	for _, id := range ids {
		if !found[id] {
			gone = append(gone, id)
		}
	}
	if len(docs) > 0 {
		if err := i.index.Upsert(ctx, docs); err != nil {
			return err
		}
	}
	if len(gone) > 0 {
		return i.index.Delete(ctx, gone)
	}
	return nil
}

func (i *Indexer) Rebuild(ctx context.Context) (int, error) {
	if !i.Enabled() {
		return 0, nil
	}
	if err := i.index.Configure(ctx); err != nil {
		return 0, err
	}
	if err := i.index.Clear(ctx); err != nil {
		return 0, err
	}
	total := 0
	after := 0
	for {
		ids, err := i.source.DocumentIDs(ctx, after, rebuildBatchSize)
		if err != nil {
			return total, err
		}
		if len(ids) == 0 {
			return total, nil
		}
		docs, err := i.source.Documents(ctx, ids)
		if err != nil {
			return total, err
		}
		if err := i.index.Upsert(ctx, docs); err != nil {
			return total, err
		}
		total += len(docs)
		after = ids[len(ids)-1]
	}
}

func normalizeIDs(ids []int) []int {
	out := make([]int, 0, len(ids))
	for _, id := range ids {
		if id > 0 {
			out = append(out, id)
		}
	}
	slices.Sort(out)
	return slices.Compact(out)
}
