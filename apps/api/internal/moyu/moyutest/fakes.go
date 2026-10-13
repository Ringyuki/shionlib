package moyutest

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type Games map[int]string

func (g Games) VNDBID(_ context.Context, gameID int, _ actor.Actor) (string, bool, error) {
	id, ok := g[gameID]
	return id, ok, nil
}

type Patches struct {
	mu      sync.Mutex
	Entries map[string][]moyu.Entry
	Fail    error
	Calls   int
}

func (p *Patches) EntriesByVNDBID(_ context.Context, vndbID string) ([]moyu.Entry, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Calls++
	if p.Fail != nil {
		return nil, p.Fail
	}
	return p.Entries[vndbID], nil
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
