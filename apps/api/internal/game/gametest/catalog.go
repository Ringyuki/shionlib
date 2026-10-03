package gametest

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Entry struct {
	Detail       game.Detail
	Views        int
	Hidden       bool
	HasResources bool
	DeveloperIDs []int
	CharacterIDs []int
}

type Catalog struct {
	mu         sync.Mutex
	entries    map[int]Entry
	LastFilter game.ListFilter
}

func NewCatalog(entries ...Entry) *Catalog {
	c := &Catalog{entries: map[int]Entry{}}
	for _, entry := range entries {
		c.Put(entry)
	}
	return c
}

func (c *Catalog) Put(entry Entry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[entry.Detail.ID] = entry
}

func (c *Catalog) Views(id int) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.entries[id].Views
}

func (c *Catalog) visible(entry Entry, visibility game.Visibility) bool {
	if entry.Hidden {
		return false
	}
	if visibility.ExcludeRated && entry.Detail.Rated() {
		return false
	}
	return !visibility.OnlyWithResources || entry.HasResources
}

func (c *Catalog) sortedIDs(descending bool) []int {
	ids := make([]int, 0, len(c.entries))
	for id := range c.entries {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	if descending {
		slices.Reverse(ids)
	}
	return ids
}

func (c *Catalog) List(_ context.Context, filter game.ListFilter, page game.Page) ([]int, int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.LastFilter = filter
	matched := []int{}
	for _, id := range c.sortedIDs(filter.SortOrder != game.SortAscending) {
		entry := c.entries[id]
		if !c.visible(entry, filter.Visibility) {
			continue
		}
		if filter.DeveloperID != nil && !slices.Contains(entry.DeveloperIDs, *filter.DeveloperID) {
			continue
		}
		if filter.CharacterID != nil && !slices.Contains(entry.CharacterIDs, *filter.CharacterID) {
			continue
		}
		matched = append(matched, id)
	}
	total := len(matched)
	start := min(max(page.Offset(), 0), total)
	end := min(start+page.Size, total)
	return matched[start:end], total, nil
}

func (c *Catalog) Listable(_ context.Context, ids []int, visibility game.Visibility) ([]int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	listable := []int{}
	for _, id := range ids {
		if entry, ok := c.entries[id]; ok && c.visible(entry, visibility) {
			listable = append(listable, id)
		}
	}
	return listable, nil
}

func (c *Catalog) CountListable(ctx context.Context, visibility game.Visibility) (int, error) {
	ids, err := c.Listable(ctx, c.allIDs(), visibility)
	return len(ids), err
}

func (c *Catalog) ListableAt(ctx context.Context, visibility game.Visibility, offset int) (int, bool, error) {
	ids, err := c.Listable(ctx, c.allIDs(), visibility)
	if err != nil || offset < 0 || offset >= len(ids) {
		return 0, false, err
	}
	return ids[offset], true, nil
}

func (c *Catalog) allIDs() []int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sortedIDs(false)
}

func (c *Catalog) Detail(_ context.Context, id int) (game.Detail, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[id]
	if !ok || entry.Hidden {
		return game.Detail{}, game.ErrNotFound
	}
	detail := entry.Detail
	detail.Relations = nil
	return detail, nil
}

func (c *Catalog) Relations(_ context.Context, id int) ([]game.Relation, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	relations := []game.Relation{}
	for _, relation := range c.entries[id].Detail.Relations {
		target, ok := c.entries[relation.ToGameID]
		if !ok || target.Hidden {
			continue
		}
		relations = append(relations, game.Relation{ID: relation.ID, Kind: relation.Kind, ToGameID: relation.ToGameID, TargetRated: target.Detail.Rated()})
	}
	return relations, nil
}

func (c *Catalog) IncreaseViews(_ context.Context, id int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[id]
	if !ok {
		return game.ErrNotFound
	}
	entry.Views++
	c.entries[id] = entry
	return nil
}

func (c *Catalog) ExternalIDs(_ context.Context, id int) (game.ExternalIDs, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[id]
	if !ok {
		return game.ExternalIDs{}, game.ErrNotFound
	}
	return game.ExternalIDs{BangumiID: entry.Detail.BID, VNDBID: entry.Detail.VID}, nil
}

func (c *Catalog) Cards(_ context.Context, ids []int) ([]game.Card, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	cards := []game.Card{}
	for _, id := range ids {
		entry, ok := c.entries[id]
		if !ok {
			continue
		}
		d := entry.Detail
		cards = append(cards, game.Card{
			ID: d.ID, Views: entry.Views, TitleJP: d.TitleJP, TitleZH: d.TitleZH, TitleEN: d.TitleEN, Aliases: d.Aliases,
			Type: d.Type, Covers: d.Covers, IntroJP: d.IntroJP, IntroZH: d.IntroZH, IntroEN: d.IntroEN,
			ReleaseDate: d.ReleaseDate, Developers: d.Developers,
		})
	}
	return cards, nil
}

func (c *Catalog) Exists(_ context.Context, id int) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.entries[id]
	return ok, nil
}

type RecentUpdates struct {
	IDs           []int
	ExpiredBefore time.Time
}

func (r *RecentUpdates) Page(_ context.Context, offset, count int, expiredBefore time.Time) ([]int, int, error) {
	r.ExpiredBefore = expiredBefore
	total := len(r.IDs)
	start := min(max(offset, 0), total)
	end := min(start+count, total)
	return slices.Clone(r.IDs[start:end]), total, nil
}

type Preferences map[int]bool

func (p Preferences) OnlyGamesWithResources(_ context.Context, userID int) (bool, error) {
	only, ok := p[userID]
	if !ok {
		return true, nil
	}
	return only, nil
}
