package moyutest

import (
	"context"
	"encoding/json"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type Games map[int]moyu.Game

func (g Games) Game(_ context.Context, gameID int, _ actor.Actor) (moyu.Game, bool, error) {
	game, ok := g[gameID]
	return game, ok, nil
}

func VNDB(id string) moyu.Game {
	return moyu.Game{Anchors: []moyu.Anchor{{Source: moyu.SourceVNDB, ID: id}}}
}

type Patches struct {
	mu        sync.Mutex
	Known     map[moyu.Anchor][]string
	Titles    map[string][]moyu.Work
	Listed    map[string][]moyu.Entry
	Fail      error
	FailWorks error
	Calls     int
	Lookups   []moyu.Anchor
	Searches  []string
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

func (p *Patches) Titled(ctx context.Context, title string) ([]moyu.Work, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.bound(ctx)
	p.Searches = append(p.Searches, title)
	if p.FailWorks != nil {
		return nil, p.FailWorks
	}
	return p.Titles[title], nil
}

func (p *Patches) Entries(ctx context.Context, vndbID string, works []string) ([]moyu.Entry, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.bound(ctx)
	p.Calls++
	if p.Fail != nil {
		return nil, p.Fail
	}
	entries := []moyu.Entry{}
	seen := map[string]bool{}
	for _, ref := range append([]string{vndbID}, works...) {
		for _, entry := range p.Listed[ref] {
			if !seen[entry.ID] {
				seen[entry.ID] = true
				entries = append(entries, entry)
			}
		}
	}
	return entries, nil
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
