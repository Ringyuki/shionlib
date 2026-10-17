package moyutest

import (
	"context"
	"encoding/json"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type Games map[int]moyu.Game

func (g Games) Game(_ context.Context, gameID int, _ actor.Actor) (moyu.Game, bool, error) {
	found, ok := g[gameID]
	return found, ok, nil
}

func VNDB(id string) moyu.Game {
	return moyu.Game{Anchors: []moyu.Anchor{{Source: moyu.SourceVNDB, ID: id}}}
}

type Assignments struct {
	mu    sync.Mutex
	Games map[int]moyu.Game
	By    map[int]int
}

func (a *Assignments) Assigned(_ context.Context, gameID int) (moyu.Game, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	found, ok := a.Games[gameID]
	if !ok {
		return moyu.Game{}, game.ErrNotFound
	}
	return found, nil
}

func (a *Assignments) Assign(_ context.Context, gameID int, pages []string, by int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	found := a.Games[gameID]
	found.Assigned, found.Pages = true, slices.Clone(pages)
	a.Games[gameID] = found
	if a.By == nil {
		a.By = map[int]int{}
	}
	a.By[gameID] = by
	return nil
}

func (a *Assignments) Unassign(_ context.Context, gameID int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	found := a.Games[gameID]
	found.Assigned, found.Pages = false, nil
	a.Games[gameID] = found
	return nil
}

type Patches struct {
	mu        sync.Mutex
	Known     map[moyu.Anchor][]string
	Listed    map[string][]moyu.Entry
	Catalog   []moyu.Page
	Resources map[string]string
	Fail      error
	FailWorks error
	Calls     int
	Lookups   []moyu.Anchor
	Queries   []moyu.PageQuery
	Unbounded int
}

func (p *Patches) bound(ctx context.Context) {
	if deadline, ok := ctx.Deadline(); !ok || time.Until(deadline) > moyu.RequestTimeout {
		p.Unbounded++
	}
}

func (p *Patches) Works(ctx context.Context, anchors []moyu.Anchor) ([]string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.bound(ctx)
	p.Lookups = append(p.Lookups, anchors...)
	if p.FailWorks != nil {
		return nil, p.FailWorks
	}
	works := []string{}
	for _, anchor := range anchors {
		for _, work := range p.Known[anchor] {
			if !slices.Contains(works, work) {
				works = append(works, work)
			}
		}
	}
	return works, nil
}

func (p *Patches) Entries(ctx context.Context, query moyu.PageQuery) ([]moyu.Entry, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.bound(ctx)
	p.Calls++
	p.Queries = append(p.Queries, query)
	if p.Fail != nil {
		return nil, p.Fail
	}
	entries := []moyu.Entry{}
	seen := map[string]bool{}
	for _, ref := range refsOf(query) {
		for _, entry := range p.Listed[ref] {
			if !seen[entry.ID] {
				seen[entry.ID] = true
				entries = append(entries, entry)
			}
		}
	}
	return entries, nil
}

func (p *Patches) pagesOf(query moyu.PageQuery) []moyu.Page {
	found := []moyu.Page{}
	for _, page := range p.Catalog {
		byID := len(query.IDs) > 0 && slices.Contains(query.IDs, page.ID)
		byRef := len(query.IDs) == 0 && ((query.VNDBID != "" && page.VNDBID == query.VNDBID) || slices.Contains(query.Works, page.WorkID))
		if byID || byRef {
			found = append(found, page)
		}
	}
	return found
}

func (p *Patches) Pages(_ context.Context, query moyu.PageQuery) ([]moyu.Page, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Queries = append(p.Queries, query)
	if p.Fail != nil {
		return nil, p.Fail
	}
	return p.pagesOf(query), nil
}

func (p *Patches) PageOfResource(_ context.Context, resourceID string) (string, bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.Fail != nil {
		return "", false, p.Fail
	}
	page, ok := p.Resources[resourceID]
	return page, ok, nil
}

func refsOf(query moyu.PageQuery) []string {
	if len(query.IDs) > 0 {
		return query.IDs
	}
	return append([]string{query.VNDBID}, query.Works...)
}

type Cache struct {
	mu      sync.Mutex
	entries map[string][]byte
	ttls    map[string]time.Duration
}

func NewCache() *Cache {
	return &Cache{entries: map[string][]byte{}, ttls: map[string]time.Duration{}}
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

func (c *Cache) Set(_ context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = raw
	c.ttls[key] = ttl
	return nil
}

func (c *Cache) Delete(_ context.Context, keys ...string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, key := range keys {
		delete(c.entries, key)
		delete(c.ttls, key)
	}
	return nil
}

func (c *Cache) Has(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.entries[key]
	return ok
}

func (c *Cache) TTL(key string) time.Duration {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.ttls[key]
}
