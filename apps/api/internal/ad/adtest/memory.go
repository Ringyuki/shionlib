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

type countKey struct {
	adID int
	slot ad.Slot
	day  time.Time
}

type MemoryRepository struct {
	mu       sync.Mutex
	now      func() time.Time
	nextID   int
	ads      map[int]ad.Ad
	counts   map[countKey]ad.Counts
	sponsors map[int]time.Time
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{now: now, ads: map[int]ad.Ad{}, counts: map[countKey]ad.Counts{}, sponsors: map[int]time.Time{}}
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

func (r *MemoryRepository) Enabled(_ context.Context, slot ad.Slot) ([]ad.Ad, error) {
	return r.matching(func(item ad.Ad) bool { return item.Enabled && slices.Contains(item.Slots, slot) }, ascending), nil
}

func (r *MemoryRepository) Running(_ context.Context, now time.Time) ([]ad.Ad, error) {
	return r.matching(func(item ad.Ad) bool { return item.Status(now) == ad.StatusRunning }, ascending), nil
}

func (r *MemoryRepository) List(_ context.Context, filter ad.ListFilter, now time.Time, page ad.Page) ([]ad.Ad, int, error) {
	matched := r.matching(func(item ad.Ad) bool {
		return (filter.Slot == nil || slices.Contains(item.Slots, *filter.Slot)) && (filter.Status == nil || item.Status(now) == *filter.Status)
	}, descending)
	start := min(page.Offset(), len(matched))
	end := min(start+page.Size, len(matched))
	return matched[start:end], len(matched), nil
}

func (r *MemoryRepository) Get(_ context.Context, id int) (ad.Ad, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.ads[id]
	if !ok {
		return ad.Ad{}, ad.ErrNotFound
	}
	return clone(item), nil
}

func (r *MemoryRepository) Create(_ context.Context, draft ad.Draft) (ad.Ad, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	now := r.now()
	item := fromDraft(ad.Ad{ID: r.nextID, Created: now}, draft, now)
	r.ads[item.ID] = item
	return clone(item), nil
}

func (r *MemoryRepository) Replace(_ context.Context, id int, draft ad.Draft) (ad.Ad, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	existing, ok := r.ads[id]
	if !ok {
		return ad.Ad{}, ad.ErrNotFound
	}
	item := fromDraft(existing, draft, r.now())
	r.ads[id] = item
	return clone(item), nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.ads[id]; !ok {
		return ad.ErrNotFound
	}
	delete(r.ads, id)
	for key := range r.counts {
		if key.adID == id {
			delete(r.counts, key)
		}
	}
	return nil
}

func (r *MemoryRepository) AddViews(_ context.Context, day time.Time, views map[ad.View]int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for view, count := range views {
		key := countKey{adID: view.AdID, slot: view.Slot, day: day}
		current := r.counts[key]
		current.Views += count
		r.counts[key] = current
	}
	return nil
}

func (r *MemoryRepository) AddClick(_ context.Context, day time.Time, view ad.View) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := countKey{adID: view.AdID, slot: view.Slot, day: day}
	current := r.counts[key]
	current.Clicks++
	r.counts[key] = current
	return nil
}

func (r *MemoryRepository) Counts(_ context.Context, ids []int, from, to time.Time) ([]ad.DailyCount, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rows := []ad.DailyCount{}
	for key, counts := range r.counts {
		if key.day.Before(from) || key.day.After(to) || (ids != nil && !slices.Contains(ids, key.adID)) {
			continue
		}
		rows = append(rows, ad.DailyCount{AdID: key.adID, Slot: key.slot, Day: key.day, Counts: counts})
	}
	slices.SortFunc(rows, func(a, b ad.DailyCount) int {
		return cmp.Or(a.Day.Compare(b.Day), cmp.Compare(a.AdID, b.AdID), cmp.Compare(a.Slot, b.Slot))
	})
	return rows, nil
}

func ascending(a, b ad.Ad) int  { return cmp.Compare(a.ID, b.ID) }
func descending(a, b ad.Ad) int { return cmp.Compare(b.ID, a.ID) }

func (r *MemoryRepository) matching(keep func(ad.Ad) bool, order func(a, b ad.Ad) int) []ad.Ad {
	r.mu.Lock()
	defer r.mu.Unlock()
	matched := []ad.Ad{}
	for _, item := range r.ads {
		if keep(item) {
			matched = append(matched, clone(item))
		}
	}
	slices.SortFunc(matched, order)
	return matched
}

func fromDraft(item ad.Ad, draft ad.Draft, now time.Time) ad.Ad {
	item.Name, item.Link = draft.Name, draft.Link
	item.Banner, item.BannerAdult = draft.Banner, draft.BannerAdult
	item.SideImage, item.SideIcon, item.SideAdult = draft.SideImage, draft.SideIcon, draft.SideAdult
	item.Slots, item.Languages = slices.Clone(draft.Slots), slices.Clone(draft.Languages)
	item.Weight, item.Enabled = draft.Weight, draft.Enabled
	item.StartAt, item.EndAt = draft.StartAt, draft.EndAt
	item.Updated = now
	return item
}

func clone(item ad.Ad) ad.Ad {
	item.Slots = slices.Clone(item.Slots)
	item.Languages = slices.Clone(item.Languages)
	return item
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

type ClickGuard struct {
	mu   sync.Mutex
	seen map[string]bool
}

func NewClickGuard() *ClickGuard {
	return &ClickGuard{seen: map[string]bool{}}
}

func (g *ClickGuard) First(_ context.Context, key string, _ time.Duration) (bool, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.seen[key] {
		return false, nil
	}
	g.seen[key] = true
	return true, nil
}

func (g *ClickGuard) Forget() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.seen = map[string]bool{}
}
