package search

import (
	"context"
	"slices"
)

type IndexService struct {
	source DocumentSource
	index  Index
	queue  IndexQueue
}

func NewIndexService(source DocumentSource, index Index, queue IndexQueue) *IndexService {
	return &IndexService{source: source, index: index, queue: queue}
}

func (i *IndexService) Enabled() bool {
	return i != nil && i.index != nil
}

func (i *IndexService) GamesChanged(ctx context.Context, ids []int) error {
	ids = normalizeIDs(ids)
	if !i.Enabled() || len(ids) == 0 {
		return nil
	}
	return i.queue.Enqueue(ctx, IndexJob{GameIDs: ids})
}

func (i *IndexService) Refresh(ctx context.Context, ids []int) error {
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

func (i *IndexService) Rebuild(ctx context.Context) (int, error) {
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
