package character

import (
	"context"
	"strings"
)

type AdminService struct {
	store AdminStore
}

func NewAdminService(store AdminStore) *AdminService {
	return &AdminService{store: store}
}

func (s *AdminService) Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error) {
	filter.Search = strings.TrimSpace(filter.Search)
	if filter.SortBy == "" {
		filter.SortBy = SortByID
	}
	return s.store.Search(ctx, filter, page)
}
