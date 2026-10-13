package charactertest

import (
	"context"
	"slices"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
)

type AdminStore struct {
	mu      sync.Mutex
	Entries []character.AdminEntry
	Total   int
	Filter  character.AdminFilter
	Page    character.Page
}

func (s *AdminStore) Search(_ context.Context, filter character.AdminFilter, page character.Page) ([]character.AdminEntry, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Filter, s.Page = filter, page
	return slices.Clone(s.Entries), s.Total, nil
}

func (s *AdminStore) Last() (character.AdminFilter, character.Page) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.Filter, s.Page
}
