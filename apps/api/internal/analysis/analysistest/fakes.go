package analysistest

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
)

type Stats struct {
	Total analysis.Totals
	Refs  map[int]analysis.GameRef
	Rated map[int]bool
	Calls int
}

func (s *Stats) Totals(context.Context) (analysis.Totals, error) {
	s.Calls++
	return s.Total, nil
}

func (s *Stats) Games(_ context.Context, ids []int) (map[int]analysis.GameRef, error) {
	out := map[int]analysis.GameRef{}
	for _, id := range ids {
		if ref, ok := s.Refs[id]; ok {
			out[id] = ref
		}
	}
	return out, nil
}

func (s *Stats) RatedFiles(_ context.Context, ids []int) (map[int]bool, error) {
	out := map[int]bool{}
	for _, id := range ids {
		out[id] = s.Rated[id]
	}
	return out, nil
}

type Served struct {
	Bytes int64
	Fail  error
}

func (s Served) BytesServed(context.Context, time.Time, time.Time) (int64, error) {
	return s.Bytes, s.Fail
}

type Traffic struct {
	Raw    analysis.RawTraffic
	Fail   error
	Window analysis.Window
	Calls  int
}

func (t *Traffic) Traffic(_ context.Context, window analysis.Window) (analysis.RawTraffic, error) {
	t.Calls++
	t.Window = window
	return t.Raw, t.Fail
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
