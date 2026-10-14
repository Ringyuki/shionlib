package friendlinktest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
)

type MemoryRepository struct {
	mu     sync.Mutex
	nextID int
	items  map[int]friendlink.Link
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{items: map[int]friendlink.Link{}}
}

func (r *MemoryRepository) List(_ context.Context, visibleOnly bool) ([]friendlink.Link, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.ordered(func(link friendlink.Link) bool { return !visibleOnly || link.Visible }), nil
}

func (r *MemoryRepository) Get(_ context.Context, id int) (friendlink.Link, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return friendlink.Link{}, friendlink.ErrNotFound
	}
	return item, nil
}

func (r *MemoryRepository) Create(_ context.Context, in friendlink.NewLink, position int) (friendlink.Link, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	now := time.Now()
	item := friendlink.Link{ID: r.nextID, Name: in.Name, URL: in.URL, Logo: in.Logo, Description: in.Description, Visible: in.Visible, Position: position, Created: now, Updated: now}
	r.items[item.ID] = item
	return item, nil
}

func (r *MemoryRepository) Update(_ context.Context, id int, changes friendlink.Changes) (friendlink.Link, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return friendlink.Link{}, friendlink.ErrNotFound
	}
	if changes.Name != nil {
		item.Name = *changes.Name
	}
	if changes.URL != nil {
		item.URL = *changes.URL
	}
	if changes.Description != nil {
		item.Description = *changes.Description
	}
	if changes.Visible != nil {
		item.Visible = *changes.Visible
	}
	if changes.Logo.Set {
		item.Logo = changes.Logo.Value
	}
	item.Updated = time.Now()
	r.items[id] = item
	return item, nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return friendlink.ErrNotFound
	}
	delete(r.items, id)
	return nil
}

func (r *MemoryRepository) LastPosition(context.Context) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	last := 0
	for _, item := range r.items {
		last = max(last, item.Position)
	}
	return last, nil
}

func (r *MemoryRepository) SetPosition(_ context.Context, id, position int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return friendlink.ErrNotFound
	}
	item.Position = position
	r.items[id] = item
	return nil
}

func (r *MemoryRepository) ordered(keep func(friendlink.Link) bool) []friendlink.Link {
	out := []friendlink.Link{}
	for _, item := range r.items {
		if keep(item) {
			out = append(out, item)
		}
	}
	slices.SortFunc(out, func(a, b friendlink.Link) int {
		return cmp.Or(cmp.Compare(a.Position, b.Position), cmp.Compare(a.ID, b.ID))
	})
	return out
}

type Transactor struct{}

func (Transactor) WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}
