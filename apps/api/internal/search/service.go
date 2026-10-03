package search

import (
	"cmp"
	"context"
	"maps"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Service struct {
	engine    Engine
	catalog   Catalog
	tags      TagStore
	cards     GameCards
	prefs     Preferences
	queue     Queue
	analytics Analytics
}

type Dependencies struct {
	Engine      Engine
	Catalog     Catalog
	Tags        TagStore
	Cards       GameCards
	Preferences Preferences
	Queue       Queue
	Analytics   Analytics
}

func NewService(deps Dependencies) *Service {
	return &Service{
		engine:    deps.Engine,
		catalog:   deps.Catalog,
		tags:      deps.Tags,
		cards:     deps.Cards,
		prefs:     deps.Preferences,
		queue:     deps.Queue,
		analytics: deps.Analytics,
	}
}

func (s *Service) Games(ctx context.Context, viewer actor.Actor, query Query) (GamePage, error) {
	if query.Q != "" {
		_ = s.queue.Enqueue(ctx, RecordSearchJob{Query: query.Q})
	}
	q, tag := strings.TrimSpace(query.Q), strings.TrimSpace(query.Tag)
	if q == "" && tag == "" {
		return GamePage{Items: []Item{}}, nil
	}
	onlyWithResources := true
	if viewer.Authenticated() {
		preferred, err := s.prefs.OnlyGamesWithResources(ctx, viewer.UserID)
		if err != nil {
			return GamePage{}, err
		}
		onlyWithResources = preferred
	}
	visibility := game.Visibility{ExcludeRated: !viewer.IncludesRated(), OnlyWithResources: onlyWithResources}
	result, err := s.engine.Search(ctx, Criteria{
		Q: q, Tag: tag, Page: query.Page,
		ExcludeRated: visibility.ExcludeRated, OnlyWithResources: visibility.OnlyWithResources,
	})
	if err != nil {
		return GamePage{}, err
	}
	ids := make([]int, len(result.Hits))
	for i, hit := range result.Hits {
		ids[i] = hit.GameID
	}
	listable, err := s.catalog.Listable(ctx, ids, visibility)
	if err != nil {
		return GamePage{}, err
	}
	cards, err := s.cards.ByIDs(ctx, listable, viewer)
	if err != nil {
		return GamePage{}, err
	}
	items := make([]Item, 0, len(result.Hits))
	for _, hit := range result.Hits {
		if card, ok := cards[hit.GameID]; ok && slices.Contains(listable, hit.GameID) {
			items = append(items, Item{Card: card, Highlight: hit.Highlight})
		}
	}
	return GamePage{Items: items, Total: result.Total, TotalPages: result.TotalPages}, nil
}

func (s *Service) Tags(ctx context.Context, query string, limit int) ([]TagMatch, error) {
	if limit <= 0 {
		return []TagMatch{}, nil
	}
	normalized := normalizeTag(query)
	tags, err := s.tags.Tags(ctx, normalized, limit)
	if err != nil {
		return nil, err
	}
	matches := make([]TagMatch, len(tags))
	for i, tag := range tags {
		matches[i] = TagMatch{Tag: tag, DisplayName: displayName(tag, normalized)}
	}
	return matches, nil
}

func normalizeTag(raw string) string {
	return strings.Join(strings.Fields(strings.ToLower(raw)), " ")
}

func displayName(tag Tag, normalized string) string {
	if normalized == "" {
		return tag.Name
	}
	for _, alias := range tag.Aliases {
		if normalizeTag(alias) == normalized {
			return alias
		}
	}
	for _, alias := range tag.Aliases {
		if strings.Contains(normalizeTag(alias), normalized) {
			return alias
		}
	}
	return tag.Name
}

func (s *Service) Trending(ctx context.Context, limit int, window *Window) ([]Term, error) {
	windows := Windows
	if window != nil {
		windows = []Window{*window}
	}
	scores := map[string]float64{}
	for _, w := range windows {
		terms, err := s.analytics.Top(ctx, w, limit)
		if err != nil {
			return nil, err
		}
		for _, term := range terms {
			scores[term.Query] += term.Score
		}
	}
	terms := make([]Term, 0, len(scores))
	for _, query := range slices.Sorted(maps.Keys(scores)) {
		terms = append(terms, Term{Query: query, Score: scores[query]})
	}
	slices.SortStableFunc(terms, func(a, b Term) int { return cmp.Compare(b.Score, a.Score) })
	return terms[:min(limit, len(terms))], nil
}

func (s *Service) Suggest(ctx context.Context, prefix string, limit int) ([]Term, error) {
	return s.analytics.Suggestions(ctx, strings.ToLower(prefix), limit)
}

func (s *Service) RecordSearch(ctx context.Context, raw string) error {
	query := strings.TrimSpace(strings.ToLower(raw))
	length := utf8.RuneCountInString(query)
	if length == 0 || length > MaxRecordedQueryLength {
		return nil
	}
	prefixes := make([]string, 0, length)
	for end := range query {
		if end > 0 {
			prefixes = append(prefixes, query[:end])
		}
	}
	prefixes = append(prefixes, query)
	return s.analytics.Increment(ctx, query, Windows, prefixes, MaxCandidatesPerPrefix)
}

func (s *Service) DecayTrends(ctx context.Context) error {
	return s.analytics.DecayTrends(ctx, Windows, DecayFactor, MinScore)
}

func (s *Service) DecaySuggestions(ctx context.Context) error {
	return s.analytics.DecaySuggestions(ctx, DecayFactor, MinScore)
}

func (s *Service) TrimSuggestions(ctx context.Context) error {
	return s.analytics.TrimSuggestions(ctx, MaxCandidatesPerPrefix)
}
