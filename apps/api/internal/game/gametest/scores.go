package gametest

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Bangumi struct {
	Scores    map[string]game.BangumiScore
	Resources map[string][]byte
	Err       error
	Calls     int
}

func (b *Bangumi) Subject(_ context.Context, subjectID string) (game.BangumiScore, error) {
	b.Calls++
	if b.Err != nil {
		return game.BangumiScore{}, b.Err
	}
	return b.Scores[subjectID], nil
}

func (b *Bangumi) Resource(_ context.Context, path string) ([]byte, error) {
	b.Calls++
	if b.Err != nil {
		return nil, b.Err
	}
	raw, ok := b.Resources[path]
	if !ok {
		return nil, game.ErrBangumiRequestFailed.WithArgs(map[string]any{"message": "not found"})
	}
	return raw, nil
}

type VNDB struct {
	Scores map[string]game.VNDBScore
	Err    error
	Calls  int
}

func (v *VNDB) Rating(_ context.Context, vndbID string) (game.VNDBScore, bool, error) {
	v.Calls++
	if v.Err != nil {
		return game.VNDBScore{}, false, v.Err
	}
	score, ok := v.Scores[vndbID]
	return score, ok, nil
}

type Cache struct {
	mu      sync.Mutex
	entries map[string][]byte
	TTLs    map[string]time.Duration
}

func NewCache() *Cache {
	return &Cache{entries: map[string][]byte{}, TTLs: map[string]time.Duration{}}
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
	c.TTLs[key] = ttl
	return nil
}

func (c *Cache) Has(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.entries[key]
	return ok
}
