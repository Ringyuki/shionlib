package searchtest

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type Catalog struct {
	mu       sync.Mutex
	Hits     map[catalog.Entity][]catalog.SearchHit
	Links    map[catalog.Entity]map[string]int
	Err      error
	Searches []string
	Unknown  []catalog.Ref
}

func NewCatalog() *Catalog {
	return &Catalog{Hits: map[catalog.Entity][]catalog.SearchHit{}, Links: map[catalog.Entity]map[string]int{}}
}

func (c *Catalog) Search(_ context.Context, sourceName string, entity catalog.Entity, query string, page, size int) (catalog.SearchResult, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Searches = append(c.Searches, fmt.Sprintf("%s:%s:%s:%d:%d", sourceName, entity, query, page, size))
	if c.Err != nil {
		return catalog.SearchResult{}, c.Err
	}
	hits := c.Hits[entity]
	start := min((page-1)*size, len(hits))
	end := min(start+size, len(hits))
	return catalog.SearchResult{Hits: hits[start:end], Total: len(hits)}, nil
}

func (c *Catalog) Resolve(_ context.Context, sourceName string, entity catalog.Entity, externalIDs []string) (map[string]int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	resolved := map[string]int{}
	for _, externalID := range externalIDs {
		if id, ok := c.Links[entity][externalID]; ok {
			resolved[externalID] = id
			continue
		}
		c.Unknown = append(c.Unknown, catalog.Ref{Source: sourceName, Entity: entity, ExternalID: externalID})
	}
	return resolved, nil
}

type Developers map[int]developer.Summary

func (d Developers) Summaries(_ context.Context, ids []int) (map[int]developer.Summary, error) {
	found := map[int]developer.Summary{}
	for _, id := range ids {
		if summary, ok := d[id]; ok {
			found[id] = summary
		}
	}
	return found, nil
}

type Characters map[int]character.Summary

func (c Characters) Summaries(_ context.Context, ids []int) (map[int]character.Summary, error) {
	found := map[int]character.Summary{}
	for _, id := range ids {
		if summary, ok := c[id]; ok {
			found[id] = summary
		}
	}
	return found, nil
}

type Titles struct {
	mu         sync.Mutex
	Known      []string
	Visibility []game.Visibility
}

func (t *Titles) Titles(_ context.Context, prefix string, visibility game.Visibility, limit int) ([]string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Visibility = append(t.Visibility, visibility)
	matched := []string{}
	for _, title := range t.Known {
		if strings.HasPrefix(strings.ToLower(title), strings.ToLower(prefix)) && len(matched) < limit {
			matched = append(matched, title)
		}
	}
	return matched, nil
}

type Tags []search.Tag

func (t Tags) Tags(_ context.Context, query string, limit int) ([]search.Tag, error) {
	matched := []search.Tag{}
	for _, tag := range t {
		if query == "" || strings.Contains(strings.ToLower(tag.Name), query) || slices.ContainsFunc(tag.Aliases, func(alias string) bool {
			return strings.Contains(strings.ToLower(alias), query)
		}) {
			matched = append(matched, tag)
		}
	}
	slices.SortStableFunc(matched, func(a, b search.Tag) int { return cmp.Compare(b.Count, a.Count) })
	return matched[:min(limit, len(matched))], nil
}

type Queue struct {
	mu   sync.Mutex
	Jobs []search.RecordSearchJob
	Err  error
}

func (q *Queue) Enqueue(_ context.Context, job search.RecordSearchJob) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.Jobs = append(q.Jobs, job)
	return q.Err
}

type Analytics struct {
	mu         sync.Mutex
	Trends     map[search.Window]map[string]float64
	DecayCalls int
}

func NewAnalytics() *Analytics {
	return &Analytics{Trends: map[search.Window]map[string]float64{}}
}

func (a *Analytics) Increment(_ context.Context, query string, windows []search.Window) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, window := range windows {
		if a.Trends[window] == nil {
			a.Trends[window] = map[string]float64{}
		}
		a.Trends[window][query]++
	}
	return nil
}

func (a *Analytics) Top(_ context.Context, window search.Window, limit int) ([]search.Term, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	terms := make([]search.Term, 0, len(a.Trends[window]))
	for query, score := range a.Trends[window] {
		terms = append(terms, search.Term{Query: query, Score: score})
	}
	slices.SortFunc(terms, func(a, b search.Term) int {
		return cmp.Or(cmp.Compare(b.Score, a.Score), cmp.Compare(b.Query, a.Query))
	})
	return terms[:min(limit, len(terms))], nil
}

func (a *Analytics) DecayTrends(_ context.Context, windows []search.Window, factor, minScore float64) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.DecayCalls++
	for _, window := range windows {
		for query, score := range a.Trends[window] {
			next := score * factor
			if next <= minScore {
				delete(a.Trends[window], query)
				continue
			}
			a.Trends[window][query] = next
		}
	}
	return nil
}
