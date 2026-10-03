package developertest

import (
	"cmp"
	"context"
	"slices"
	"strings"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
)

type link struct {
	developerID int
	hidden      bool
}

type MemoryRepository struct {
	mu         sync.Mutex
	nextID     int
	developers map[int]developer.Developer
	links      []link
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{developers: map[int]developer.Developer{}}
}

func (r *MemoryRepository) Seed(d developer.Developer) developer.Developer {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	d.ID = r.nextID
	r.developers[d.ID] = d
	return d
}

func (r *MemoryRepository) Link(developerID int, hidden bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.links = append(r.links, link{developerID: developerID, hidden: hidden})
}

func (r *MemoryRepository) List(_ context.Context, query string, page developer.Page) ([]developer.Summary, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	matched := []developer.Developer{}
	for _, d := range r.developers {
		if query == "" || matches(d, query) {
			matched = append(matched, d)
		}
	}
	slices.SortFunc(matched, func(a, b developer.Developer) int {
		return cmp.Or(cmp.Compare(a.Name, b.Name), cmp.Compare(a.ID, b.ID))
	})
	total := len(matched)
	start := min(max(page.Offset(), 0), total)
	end := min(start+page.Size, total)
	summaries := make([]developer.Summary, 0, end-start)
	for _, d := range matched[start:end] {
		summaries = append(summaries, developer.Summary{ID: d.ID, Name: d.Name, Aliases: d.Aliases, Logo: d.Logo, WorksCount: r.works(d.ID)})
	}
	return summaries, total, nil
}

func (r *MemoryRepository) works(id int) int {
	count := 0
	for _, l := range r.links {
		if l.developerID == id && !l.hidden {
			count++
		}
	}
	return count
}

func matches(d developer.Developer, query string) bool {
	needle := strings.ToLower(query)
	return slices.ContainsFunc(append([]string{d.Name}, d.Aliases...), func(value string) bool {
		return strings.Contains(strings.ToLower(value), needle)
	})
}

func (r *MemoryRepository) Get(_ context.Context, id int) (developer.Developer, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	d, ok := r.developers[id]
	if !ok {
		return developer.Developer{}, developer.ErrNotFound
	}
	return d, nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (developer.Developer, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) HasRelations(_ context.Context, id int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.ContainsFunc(r.links, func(l link) bool { return l.developerID == id }), nil
}

func (r *MemoryRepository) HasChildren(_ context.Context, id int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, d := range r.developers {
		if d.ParentID != nil && *d.ParentID == id {
			return true, nil
		}
	}
	return false, nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.developers[id]; !ok {
		return developer.ErrNotFound
	}
	if slices.ContainsFunc(r.links, func(l link) bool { return l.developerID == id }) {
		return developer.ErrHasRelations
	}
	delete(r.developers, id)
	for childID, child := range r.developers {
		if child.ParentID != nil && *child.ParentID == id {
			child.ParentID = nil
			r.developers[childID] = child
		}
	}
	return nil
}
