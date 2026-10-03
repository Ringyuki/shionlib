package searchtest

import (
	"cmp"
	"context"
	"slices"
	"strings"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type Engine struct {
	Result   search.Result
	Err      error
	Criteria []search.Criteria
}

func (e *Engine) Search(_ context.Context, criteria search.Criteria) (search.Result, error) {
	e.Criteria = append(e.Criteria, criteria)
	return e.Result, e.Err
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
	mu          sync.Mutex
	Trends      map[search.Window]map[string]float64
	Prefixes    map[string]map[string]float64
	DecayCalls  int
	TrimmedKeep int
}

func NewAnalytics() *Analytics {
	return &Analytics{Trends: map[search.Window]map[string]float64{}, Prefixes: map[string]map[string]float64{}}
}

func (a *Analytics) Increment(_ context.Context, query string, windows []search.Window, prefixes []string, _ int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, window := range windows {
		if a.Trends[window] == nil {
			a.Trends[window] = map[string]float64{}
		}
		a.Trends[window][query]++
	}
	for _, prefix := range prefixes {
		if a.Prefixes[prefix] == nil {
			a.Prefixes[prefix] = map[string]float64{}
		}
		a.Prefixes[prefix][query]++
	}
	return nil
}

func top(scores map[string]float64, limit int) []search.Term {
	terms := make([]search.Term, 0, len(scores))
	for query, score := range scores {
		terms = append(terms, search.Term{Query: query, Score: score})
	}
	slices.SortFunc(terms, func(a, b search.Term) int {
		return cmp.Or(cmp.Compare(b.Score, a.Score), cmp.Compare(b.Query, a.Query))
	})
	return terms[:min(limit, len(terms))]
}

func (a *Analytics) Top(_ context.Context, window search.Window, limit int) ([]search.Term, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return top(a.Trends[window], limit), nil
}

func (a *Analytics) Suggestions(_ context.Context, prefix string, limit int) ([]search.Term, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return top(a.Prefixes[prefix], limit), nil
}

func (a *Analytics) DecayTrends(_ context.Context, windows []search.Window, factor, minScore float64) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.DecayCalls++
	for _, window := range windows {
		decay(a.Trends[window], factor, minScore)
	}
	return nil
}

func (a *Analytics) DecaySuggestions(_ context.Context, factor, minScore float64) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.DecayCalls++
	for _, scores := range a.Prefixes {
		decay(scores, factor, minScore)
	}
	return nil
}

func decay(scores map[string]float64, factor, minScore float64) {
	for query, score := range scores {
		next := score * factor
		if next <= minScore {
			delete(scores, query)
			continue
		}
		scores[query] = next
	}
}

func (a *Analytics) TrimSuggestions(_ context.Context, keep int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.TrimmedKeep = keep
	return nil
}
