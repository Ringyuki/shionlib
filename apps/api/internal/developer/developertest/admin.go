package developertest

import (
	"context"
	"slices"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
)

type AdminStore struct {
	mu      sync.Mutex
	Entries []developer.AdminEntry
	Total   int
	Filter  developer.AdminFilter
	Page    developer.Page
}

func (s *AdminStore) Search(_ context.Context, filter developer.AdminFilter, page developer.Page) ([]developer.AdminEntry, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Filter, s.Page = filter, page
	return slices.Clone(s.Entries), s.Total, nil
}

func (s *AdminStore) Last() (developer.AdminFilter, developer.Page) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.Filter, s.Page
}
