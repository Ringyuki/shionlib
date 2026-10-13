package settingtest

import (
	"context"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Source map[string]any

func (s Source) Lookup(name string) (any, bool) {
	value, ok := s[name]
	return value, ok
}

func Set[T setting.Scalar](source Source, key setting.Key[T], value T) Source {
	source[key.Name()] = value
	return source
}

type Announcer struct {
	mu    sync.Mutex
	calls int
}

func (a *Announcer) Announce(context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.calls++
}

func (a *Announcer) Calls() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.calls
}
