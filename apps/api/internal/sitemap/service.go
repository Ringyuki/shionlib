package sitemap

import (
	"context"
	"slices"
	"strconv"
)

type Service struct {
	store Store
	cache Cache
}

func NewService(store Store, cache Cache) *Service {
	return &Service{store: store, cache: cache}
}

func (s *Service) Sections(ctx context.Context) ([]SectionPages, error) {
	return cached(ctx, s.cache, "sitemap:sections", func() ([]SectionPages, error) {
		sections := make([]SectionPages, 0, len(Sections))
		for _, section := range Sections {
			count, err := s.store.Count(ctx, section)
			if err != nil {
				return nil, err
			}
			sections = append(sections, SectionPages{Section: section, Pages: (count + PageSize - 1) / PageSize})
		}
		return sections, nil
	})
}

func (s *Service) Entries(ctx context.Context, section Section, page int) ([]Entry, error) {
	if !slices.Contains(Sections, section) || page < 1 {
		return []Entry{}, nil
	}
	return cached(ctx, s.cache, "sitemap:entries:"+string(section)+":"+strconv.Itoa(page), func() ([]Entry, error) {
		return s.store.Entries(ctx, section, (page-1)*PageSize, PageSize)
	})
}

func cached[T any](ctx context.Context, cache Cache, key string, build func() (T, error)) (T, error) {
	var value T
	if found, err := cache.Get(ctx, key, &value); err == nil && found {
		return value, nil
	}
	value, err := build()
	if err != nil {
		var zero T
		return zero, err
	}
	_ = cache.Set(ctx, key, value, CacheTTL)
	return value, nil
}
