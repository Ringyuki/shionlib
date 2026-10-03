package adtest

import (
	"cmp"
	"context"
	"encoding/json"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
)

type MemoryRepository struct {
	mu       sync.Mutex
	now      func() time.Time
	nextID   int
	ads      map[int]ad.Ad
	sponsors map[int]time.Time
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{now: now, ads: map[int]ad.Ad{}, sponsors: map[int]time.Time{}}
}

func (r *MemoryRepository) SetSponsor(userID int, until time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sponsors[userID] = until
}

func (r *MemoryRepository) IsSponsor(_ context.Context, userID int, at time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	until, ok := r.sponsors[userID]
	return ok && until.After(at), nil
}

func (r *MemoryRepository) Active(_ context.Context, placement string, at time.Time) ([]ad.Ad, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	active := []ad.Ad{}
	for _, item := range r.ads {
		if !item.Enabled || !slices.Contains(item.Placement, placement) {
			continue
		}
		if item.StartAt != nil && item.StartAt.After(at) {
			continue
		}
		if item.EndAt != nil && item.EndAt.Before(at) {
			continue
		}
		active = append(active, item)
	}
	slices.SortFunc(active, func(a, b ad.Ad) int {
		if c := cmp.Compare(a.Sort, b.Sort); c != 0 {
			return c
		}
		return cmp.Compare(a.ID, b.ID)
	})
	return active, nil
}

func (r *MemoryRepository) List(_ context.Context, filter ad.ListFilter, page ad.Page) ([]ad.Ad, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	matched := []ad.Ad{}
	for _, item := range r.ads {
		if filter.Placement != nil && !slices.Contains(item.Placement, *filter.Placement) {
			continue
		}
		if filter.Enabled != nil && item.Enabled != *filter.Enabled {
			continue
		}
		matched = append(matched, item)
	}
	slices.SortFunc(matched, func(a, b ad.Ad) int {
		c := compareBy(filter.SortBy, a, b)
		if c == 0 {
			c = cmp.Compare(a.ID, b.ID)
		}
		if filter.Descending {
			return -c
		}
		return c
	})
	total := len(matched)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	return matched[start:end], total, nil
}

func compareBy(field ad.SortField, a, b ad.Ad) int {
	switch field {
	case ad.SortBySort:
		return cmp.Compare(a.Sort, b.Sort)
	case ad.SortByCreated:
		return a.Created.Compare(b.Created)
	case ad.SortByUpdated:
		return a.Updated.Compare(b.Updated)
	default:
		return cmp.Compare(a.ID, b.ID)
	}
}

func (r *MemoryRepository) Get(_ context.Context, id int) (ad.Ad, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.ads[id]
	if !ok {
		return ad.Ad{}, ad.ErrNotFound
	}
	return item, nil
}

func (r *MemoryRepository) Create(_ context.Context, in ad.NewAd) (ad.Ad, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	now := r.now()
	item := ad.Ad{
		ID:             r.nextID,
		Name:           in.Name,
		Placement:      slices.Clone(in.Placement),
		ImageZH:        in.ImageZH,
		ImageJA:        in.ImageJA,
		ImageEN:        in.ImageEN,
		Aspect:         in.Aspect,
		Link:           in.Link,
		ExcludeLocales: slices.Clone(in.ExcludeLocales),
		Enabled:        in.Enabled,
		Sort:           in.Sort,
		StartAt:        in.StartAt,
		EndAt:          in.EndAt,
		Created:        now,
		Updated:        now,
	}
	r.ads[item.ID] = item
	return item, nil
}

func (r *MemoryRepository) Update(_ context.Context, id int, changes ad.Changes) (ad.Ad, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.ads[id]
	if !ok {
		return ad.Ad{}, ad.ErrNotFound
	}
	assign(&item.Name, changes.Name)
	if changes.Placement != nil {
		item.Placement = slices.Clone(*changes.Placement)
	}
	assign(&item.ImageZH, changes.ImageZH)
	applyClearable(&item.ImageJA, changes.ImageJA)
	applyClearable(&item.ImageEN, changes.ImageEN)
	assign(&item.Aspect, changes.Aspect)
	assign(&item.Link, changes.Link)
	if changes.ExcludeLocales != nil {
		item.ExcludeLocales = slices.Clone(*changes.ExcludeLocales)
	}
	assign(&item.Enabled, changes.Enabled)
	assign(&item.Sort, changes.Sort)
	applyClearable(&item.StartAt, changes.StartAt)
	applyClearable(&item.EndAt, changes.EndAt)
	item.Updated = r.now()
	r.ads[id] = item
	return item, nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.ads[id]; !ok {
		return ad.ErrNotFound
	}
	delete(r.ads, id)
	return nil
}

func assign[T any](target *T, value *T) {
	if value != nil {
		*target = *value
	}
}

func applyClearable[T any](target **T, value ad.Clearable[T]) {
	if value.Set {
		*target = value.Value
	}
}

type Cache struct {
	mu      sync.Mutex
	entries map[string][]byte
}

func NewCache() *Cache {
	return &Cache{entries: map[string][]byte{}}
}

func (c *Cache) Get(_ context.Context, key string, dst any) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	raw, ok := c.entries[key]
	if !ok {
		return false, nil
	}
	return true, json.Unmarshal(raw, dst)
}

func (c *Cache) Set(_ context.Context, key string, value any, _ time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = raw
	return nil
}

func (c *Cache) DeletePrefix(_ context.Context, prefix string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key := range c.entries {
		if strings.HasPrefix(key, prefix) {
			delete(c.entries, key)
		}
	}
	return nil
}

func (c *Cache) Has(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.entries[key]
	return ok
}
