package search

import (
	"cmp"
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"
	"unicode/utf8"

	"golang.org/x/sync/errgroup"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Deps struct {
	Source     string
	Catalog    Catalog
	Games      Games
	Cards      GameCards
	Developers Developers
	Characters Characters
	Titles     Titles
	Tags       TagStore
	Cache      Cache
	Queue      Queue
	Analytics  Analytics
}

type Service struct {
	source     string
	catalog    Catalog
	listing    Games
	cards      GameCards
	developers Developers
	characters Characters
	titles     Titles
	tags       TagStore
	cache      Cache
	queue      Queue
	analytics  Analytics
}

func NewService(deps Deps) *Service {
	return &Service{
		source:     deps.Source,
		catalog:    deps.Catalog,
		listing:    deps.Games,
		cards:      deps.Cards,
		developers: deps.Developers,
		characters: deps.Characters,
		titles:     deps.Titles,
		tags:       deps.Tags,
		cache:      deps.Cache,
		queue:      deps.Queue,
		analytics:  deps.Analytics,
	}
}

func (s *Service) Search(ctx context.Context, viewer actor.Actor, query Query) (Results, error) {
	results := Results{
		Games:      Section[game.Card]{Items: []game.Card{}},
		Developers: Section[developer.Summary]{Items: []developer.Summary{}},
		Characters: Section[character.Summary]{Items: []character.Summary{}},
	}
	q := collapseSpaces(query.Q)
	if q == "" {
		return results, nil
	}
	group, ctx := errgroup.WithContext(ctx)
	group.SetLimit(len(Kinds))
	for _, kind := range requested(query.Kinds) {
		group.Go(func() error {
			ids, total, err := s.lookup(ctx, kind, q, query.Page, query.Size)
			if err != nil {
				return err
			}
			switch kind {
			case catalog.EntityGame:
				results.Games, err = s.gameSection(ctx, viewer, ids, total)
			case catalog.EntityDeveloper:
				results.Developers, err = section(ctx, ids, total, s.developers.Summaries)
			case catalog.EntityCharacter:
				results.Characters, err = section(ctx, ids, total, s.characters.Summaries)
			}
			return err
		})
	}
	if err := group.Wait(); err != nil {
		return Results{}, err
	}
	return results, nil
}

func requested(kinds []catalog.Entity) []catalog.Entity {
	return slices.DeleteFunc(slices.Clone(Kinds), func(kind catalog.Entity) bool { return !slices.Contains(kinds, kind) })
}

func collapseSpaces(raw string) string {
	return strings.Join(strings.Fields(raw), " ")
}

func (s *Service) lookup(ctx context.Context, kind catalog.Entity, q string, page, size int) ([]int, int, error) {
	if reference, ok := ParseReference(q); ok {
		return s.referenced(ctx, kind, reference, page, size)
	}
	found, err := s.upstream(ctx, kind, q, page, size)
	if err != nil {
		return nil, 0, err
	}
	local, err := s.catalog.Resolve(ctx, s.source, kind, found.ExternalIDs)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int, 0, len(found.ExternalIDs))
	for _, externalID := range found.ExternalIDs {
		if id, ok := local[externalID]; ok && !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return ids, found.Total, nil
}

func (s *Service) referenced(ctx context.Context, kind catalog.Entity, reference game.Reference, page, size int) ([]int, int, error) {
	if kind != catalog.EntityGame {
		return []int{}, 0, nil
	}
	ids, err := s.listing.Referenced(ctx, reference)
	if err != nil {
		return nil, 0, err
	}
	start := min((page-1)*size, len(ids))
	return ids[start:min(start+size, len(ids))], len(ids), nil
}

func (s *Service) upstream(ctx context.Context, kind catalog.Entity, q string, page, size int) (UpstreamPage, error) {
	key := fmt.Sprintf("search:upstream:%s:%s:%d:%d:%s", s.source, kind, page, size, strings.ToLower(q))
	var cached UpstreamPage
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	result, err := s.catalog.Search(ctx, s.source, kind, q, page, size)
	if err != nil {
		return UpstreamPage{}, err
	}
	fresh := UpstreamPage{ExternalIDs: make([]string, len(result.Hits)), Total: result.Total}
	for i, hit := range result.Hits {
		fresh.ExternalIDs[i] = hit.ExternalID
	}
	_ = s.cache.Set(ctx, key, fresh, UpstreamCacheTTL)
	return fresh, nil
}

func (s *Service) gameSection(ctx context.Context, viewer actor.Actor, ids []int, total int) (Section[game.Card], error) {
	listable, err := s.listing.Listable(ctx, ids, game.Visibility{ExcludeRated: !viewer.IncludesRated()})
	if err != nil {
		return Section[game.Card]{}, err
	}
	cards, err := s.cards.ByIDs(ctx, listable, viewer)
	if err != nil {
		return Section[game.Card]{}, err
	}
	return Section[game.Card]{Items: inOrder(ids, cards), Total: total}, nil
}

func section[T any](ctx context.Context, ids []int, total int, load func(context.Context, []int) (map[int]T, error)) (Section[T], error) {
	byID, err := load(ctx, ids)
	if err != nil {
		return Section[T]{}, err
	}
	return Section[T]{Items: inOrder(ids, byID), Total: total}, nil
}

func inOrder[T any](ids []int, byID map[int]T) []T {
	items := make([]T, 0, len(ids))
	for _, id := range ids {
		if item, ok := byID[id]; ok {
			items = append(items, item)
		}
	}
	return items
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

func (s *Service) Suggest(ctx context.Context, viewer actor.Actor, prefix string, limit int) ([]string, error) {
	normalized := collapseSpaces(prefix)
	if normalized == "" || limit <= 0 {
		return []string{}, nil
	}
	return s.titles.Titles(ctx, normalized, game.Visibility{ExcludeRated: !viewer.IncludesRated()}, limit)
}

func (s *Service) Record(ctx context.Context, raw string) error {
	query, ok := recordable(raw)
	if !ok {
		return nil
	}
	return s.queue.Enqueue(ctx, RecordSearchJob{Query: query})
}

func (s *Service) RecordSearch(ctx context.Context, raw string) error {
	query, ok := recordable(raw)
	if !ok {
		return nil
	}
	return s.analytics.Increment(ctx, query, Windows)
}

func recordable(raw string) (string, bool) {
	query := strings.ToLower(collapseSpaces(raw))
	length := utf8.RuneCountInString(query)
	if _, reference := ParseReference(query); reference {
		return query, false
	}
	return query, length > 0 && length <= MaxRecordedQueryLength
}

func (s *Service) DecayTrends(ctx context.Context) error {
	return s.analytics.DecayTrends(ctx, Windows, DecayFactor, MinScore)
}
