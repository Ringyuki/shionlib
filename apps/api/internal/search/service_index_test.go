package search_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type documentSource struct {
	docs map[int]search.Document
}

func (s documentSource) Documents(_ context.Context, ids []int) ([]search.Document, error) {
	var out []search.Document
	for _, id := range ids {
		if doc, ok := s.docs[id]; ok {
			out = append(out, doc)
		}
	}
	return out, nil
}

func (s documentSource) DocumentIDs(_ context.Context, afterID, limit int) ([]int, error) {
	var ids []int
	for id := range s.docs {
		if id > afterID {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	if len(ids) > limit {
		ids = ids[:limit]
	}
	return ids, nil
}

type recordingIndex struct {
	configured, cleared int
	upserted, deleted   []int
	err                 error
}

func (i *recordingIndex) Configure(context.Context) error {
	i.configured++
	return i.err
}

func (i *recordingIndex) Upsert(_ context.Context, docs []search.Document) error {
	for _, doc := range docs {
		i.upserted = append(i.upserted, doc.ID)
	}
	return i.err
}

func (i *recordingIndex) Delete(_ context.Context, ids []int) error {
	i.deleted = append(i.deleted, ids...)
	return i.err
}

func (i *recordingIndex) Clear(context.Context) error {
	i.cleared++
	return i.err
}

type indexQueue struct {
	jobs []search.IndexJob
}

func (q *indexQueue) Enqueue(_ context.Context, job search.IndexJob) error {
	q.jobs = append(q.jobs, job)
	return nil
}

func TestIndexerWithoutAnIndexDoesNothing(t *testing.T) {
	indexer := search.NewIndexService(nil, nil, nil)
	if indexer.Enabled() {
		t.Fatal("no index configured")
	}
	if err := indexer.GamesChanged(context.Background(), []int{1}); err != nil {
		t.Fatal(err)
	}
	if err := indexer.Refresh(context.Background(), []int{1}); err != nil {
		t.Fatal(err)
	}
	if count, err := indexer.Rebuild(context.Background()); err != nil || count != 0 {
		t.Fatalf("rebuild %d %v", count, err)
	}
}

func TestGamesChangedQueuesNormalizedIDs(t *testing.T) {
	queue := &indexQueue{}
	indexer := search.NewIndexService(documentSource{}, &recordingIndex{}, queue)
	if err := indexer.GamesChanged(context.Background(), []int{3, 1, 3, 0, -2}); err != nil {
		t.Fatal(err)
	}
	if err := indexer.GamesChanged(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
	if len(queue.jobs) != 1 || !slices.Equal(queue.jobs[0].GameIDs, []int{1, 3}) || queue.jobs[0].Kind() != "search_index" {
		t.Fatalf("jobs %+v", queue.jobs)
	}
}

func TestRefreshUpsertsExistingAndDeletesMissingGames(t *testing.T) {
	index := &recordingIndex{}
	indexer := search.NewIndexService(documentSource{docs: map[int]search.Document{1: {ID: 1}, 2: {ID: 2}}}, index, &indexQueue{})
	if err := indexer.Refresh(context.Background(), []int{2, 1, 9}); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(index.upserted, []int{1, 2}) || !slices.Equal(index.deleted, []int{9}) {
		t.Fatalf("upserted %v deleted %v", index.upserted, index.deleted)
	}
	index.err = errors.New("meili down")
	if err := indexer.Refresh(context.Background(), []int{1}); err == nil {
		t.Fatal("index failures surface")
	}
}

func TestRebuildReplacesTheIndexInBatches(t *testing.T) {
	docs := map[int]search.Document{}
	for id := 1; id <= 1203; id++ {
		docs[id] = search.Document{ID: id}
	}
	index := &recordingIndex{}
	count, err := search.NewIndexService(documentSource{docs: docs}, index, &indexQueue{}).Rebuild(context.Background())
	if err != nil || count != 1203 {
		t.Fatalf("rebuild %d %v", count, err)
	}
	if index.configured != 1 || index.cleared != 1 || len(index.upserted) != 1203 || index.upserted[1202] != 1203 {
		t.Fatalf("index %d %d %d", index.configured, index.cleared, len(index.upserted))
	}
}
