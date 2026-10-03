package favoritetest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
)

type MemoryRepository struct {
	mu        sync.Mutex
	now       func() time.Time
	nextID    int
	nextItem  int
	favorites map[int]favorite.Favorite
	items     map[int]favorite.Item
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:       now,
		favorites: map[int]favorite.Favorite{},
		items:     map[int]favorite.Item{},
	}
}

func (r *MemoryRepository) Seed(f favorite.Favorite) favorite.Favorite {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	f.ID = r.nextID
	f.Created, f.Updated = r.now(), r.now()
	r.favorites[f.ID] = f
	return f
}

func (r *MemoryRepository) Get(_ context.Context, id int) (favorite.Favorite, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fav, ok := r.favorites[id]
	if !ok {
		return favorite.Favorite{}, favorite.ErrNotFound
	}
	return fav, nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (favorite.Favorite, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) FindByName(_ context.Context, userID int, name string) (favorite.Favorite, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, fav := range r.favorites {
		if fav.UserID == userID && fav.Name == name {
			return fav, true, nil
		}
	}
	return favorite.Favorite{}, false, nil
}

func (r *MemoryRepository) Create(_ context.Context, in favorite.NewFavorite) (favorite.Favorite, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, fav := range r.favorites {
		if fav.UserID == in.UserID && fav.Name == in.Name {
			return favorite.Favorite{}, favorite.ErrAlreadyExists
		}
	}
	r.nextID++
	fav := favorite.Favorite{
		ID:          r.nextID,
		UserID:      in.UserID,
		Name:        in.Name,
		Description: in.Description,
		IsPrivate:   in.IsPrivate,
		Created:     r.now(),
		Updated:     r.now(),
	}
	r.favorites[fav.ID] = fav
	return fav, nil
}

func (r *MemoryRepository) Update(_ context.Context, id int, changes favorite.Changes) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	fav, ok := r.favorites[id]
	if !ok {
		return favorite.ErrNotFound
	}
	if changes.Name != nil {
		for _, other := range r.favorites {
			if other.ID != id && other.UserID == fav.UserID && other.Name == *changes.Name {
				return favorite.ErrNameAlreadyExists
			}
		}
		fav.Name = *changes.Name
	}
	if changes.Description != nil {
		description := *changes.Description
		fav.Description = &description
	}
	if changes.IsPrivate != nil {
		fav.IsPrivate = *changes.IsPrivate
	}
	fav.Updated = r.now()
	r.favorites[id] = fav
	return nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.favorites[id]; !ok {
		return favorite.ErrNotFound
	}
	delete(r.favorites, id)
	for itemID, item := range r.items {
		if item.FavoriteID == id {
			delete(r.items, itemID)
		}
	}
	return nil
}

func (r *MemoryRepository) List(_ context.Context, filter favorite.ListFilter) ([]favorite.Summary, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	summaries := []favorite.Summary{}
	for _, fav := range r.favorites {
		if fav.UserID != filter.OwnerID || (filter.PublicOnly && fav.IsPrivate) {
			continue
		}
		summary := favorite.Summary{Favorite: fav}
		contains := false
		for _, item := range r.items {
			if item.FavoriteID != fav.ID {
				continue
			}
			summary.GameCount++
			if filter.ContainGame != nil && item.GameID == *filter.ContainGame {
				contains = true
			}
		}
		if filter.ContainGame != nil {
			summary.IsFavorite = &contains
		}
		summaries = append(summaries, summary)
	}
	slices.SortFunc(summaries, compareSummaries)
	return summaries, nil
}

func compareSummaries(a, b favorite.Summary) int {
	if a.Default != b.Default {
		if a.Default {
			return -1
		}
		return 1
	}
	return cmp.Compare(a.ID, b.ID)
}

func (r *MemoryRepository) GetItem(_ context.Context, id int) (favorite.Item, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return favorite.Item{}, favorite.ErrItemNotFound
	}
	item.OwnerID = r.favorites[item.FavoriteID].UserID
	return item, nil
}

func (r *MemoryRepository) FindItem(_ context.Context, favoriteID, gameID int) (favorite.Item, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, item := range r.items {
		if item.FavoriteID == favoriteID && item.GameID == gameID {
			item.OwnerID = r.favorites[item.FavoriteID].UserID
			return item, true, nil
		}
	}
	return favorite.Item{}, false, nil
}

func (r *MemoryRepository) CreateItem(_ context.Context, in favorite.NewItem) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.favorites[in.FavoriteID]; !ok {
		return favorite.ErrNotFound
	}
	for _, item := range r.items {
		if item.FavoriteID == in.FavoriteID && item.GameID == in.GameID {
			return favorite.ErrItemAlreadyExists
		}
	}
	r.nextItem++
	r.items[r.nextItem] = favorite.Item{ID: r.nextItem, FavoriteID: in.FavoriteID, GameID: in.GameID, Note: in.Note, Created: r.now()}
	return nil
}

func (r *MemoryRepository) UpdateItemNote(_ context.Context, id int, note string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return favorite.ErrItemNotFound
	}
	item.Note = &note
	r.items[id] = item
	return nil
}

func (r *MemoryRepository) DeleteItem(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return favorite.ErrItemNotFound
	}
	delete(r.items, id)
	return nil
}

func (r *MemoryRepository) ListItems(_ context.Context, favoriteID int, page favorite.Page) ([]favorite.Item, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	items := []favorite.Item{}
	for _, item := range r.items {
		if item.FavoriteID == favoriteID {
			item.OwnerID = r.favorites[favoriteID].UserID
			items = append(items, item)
		}
	}
	slices.SortFunc(items, func(a, b favorite.Item) int {
		if c := b.Created.Compare(a.Created); c != 0 {
			return c
		}
		return cmp.Compare(b.ID, a.ID)
	})
	total := len(items)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	return items[start:end], total, nil
}

func (r *MemoryRepository) HasGame(_ context.Context, userID, gameID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, item := range r.items {
		if item.GameID == gameID && r.favorites[item.FavoriteID].UserID == userID {
			return true, nil
		}
	}
	return false, nil
}
