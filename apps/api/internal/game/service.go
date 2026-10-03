package game

import (
	"context"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

const RecentUpdateRetention = 30 * 24 * time.Hour

type Service struct {
	repo   Repository
	recent RecentUpdates
	prefs  Preferences
	cards  CardLookup
	now    func() time.Time
	intn   func(n int) int
}

func NewService(repo Repository, recent RecentUpdates, prefs Preferences, cards CardLookup, now func() time.Time, intn func(n int) int) *Service {
	return &Service{repo: repo, recent: recent, prefs: prefs, cards: cards, now: now, intn: intn}
}

func (s *Service) List(ctx context.Context, viewer actor.Actor, query ListQuery) ([]Card, int, error) {
	onlyWithResources, err := s.onlyWithResources(ctx, viewer, query)
	if err != nil {
		return nil, 0, err
	}
	filter := ListFilter{
		Visibility:     Visibility{ExcludeRated: !viewer.IncludesRated(), OnlyWithResources: onlyWithResources},
		DeveloperID:    nonZero(query.DeveloperID),
		CharacterID:    nonZero(query.CharacterID),
		Tags:           query.Tags,
		ExcludeTags:    query.ExcludeTags,
		Platforms:      query.Platforms,
		ReleasePeriods: ReleasePeriods(query.Years, query.Months, s.now()),
		ReleasedAfter:  query.StartDate,
		ReleasedBefore: query.EndDate,
		SortBy:         query.SortBy,
		SortOrder:      query.SortOrder,
	}
	if filter.SortBy == "" {
		filter.SortBy = SortByReleaseDate
	}
	if filter.SortOrder == "" {
		filter.SortOrder = SortDescending
	}
	ids, total, err := s.repo.List(ctx, filter, query.Page)
	if err != nil {
		return nil, 0, err
	}
	cards, err := s.ordered(ctx, ids, viewer)
	if err != nil {
		return nil, 0, err
	}
	return cards, total, nil
}

func (s *Service) onlyWithResources(ctx context.Context, viewer actor.Actor, query ListQuery) (bool, error) {
	if query.entityPage() {
		return false, nil
	}
	if !viewer.Authenticated() {
		return true, nil
	}
	return s.prefs.OnlyGamesWithResources(ctx, viewer.UserID)
}

func (s *Service) Random(ctx context.Context, viewer actor.Actor) (int, bool, error) {
	visibility := Visibility{ExcludeRated: !viewer.IncludesRated()}
	count, err := s.repo.CountListable(ctx, visibility)
	if err != nil || count == 0 {
		return 0, false, err
	}
	return s.repo.ListableAt(ctx, visibility, s.intn(count))
}

func (s *Service) RecentUpdates(ctx context.Context, viewer actor.Actor, page Page) ([]Card, int, error) {
	ids, total, err := s.recent.Page(ctx, page.Offset(), page.Size, s.now().Add(-RecentUpdateRetention))
	if err != nil {
		return nil, 0, err
	}
	listable, err := s.repo.Listable(ctx, ids, Visibility{ExcludeRated: !viewer.IncludesRated()})
	if err != nil {
		return nil, 0, err
	}
	visible := slices.DeleteFunc(slices.Clone(ids), func(id int) bool { return !slices.Contains(listable, id) })
	cards, err := s.ordered(ctx, visible, viewer)
	if err != nil {
		return nil, 0, err
	}
	return cards, total, nil
}

func (s *Service) Get(ctx context.Context, viewer actor.Actor, id int) (Detail, error) {
	detail, err := s.visibleDetail(ctx, viewer, id)
	if err != nil {
		return Detail{}, err
	}
	if !viewer.IncludesRated() {
		detail.Images = nil
		detail.ImagesWithheld = true
	}
	return detail, nil
}

func (s *Service) Header(ctx context.Context, viewer actor.Actor, id int) (Detail, error) {
	return s.visibleDetail(ctx, viewer, id)
}

func (s *Service) Characters(ctx context.Context, viewer actor.Actor, id int) ([]CharacterCredit, error) {
	detail, err := s.visibleDetail(ctx, viewer, id)
	if err != nil {
		return nil, err
	}
	return detail.Characters, nil
}

func (s *Service) Details(ctx context.Context, viewer actor.Actor, id int) (Detail, error) {
	detail, err := s.visibleDetail(ctx, viewer, id)
	if err != nil {
		return Detail{}, err
	}
	relations, err := s.repo.Relations(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	relations = slices.DeleteFunc(relations, func(r Relation) bool { return r.TargetRated && !viewer.IncludesRated() })
	targets := make([]int, len(relations))
	for i, relation := range relations {
		targets[i] = relation.ToGameID
	}
	cards, err := s.cards.ByIDs(ctx, targets, viewer)
	if err != nil {
		return Detail{}, err
	}
	detail.Relations = make([]Relation, 0, len(relations))
	for _, relation := range relations {
		card, ok := cards[relation.ToGameID]
		if !ok {
			continue
		}
		relation.Target = card
		detail.Relations = append(detail.Relations, relation)
	}
	return detail, nil
}

func (s *Service) IncreaseViews(ctx context.Context, id int) error {
	return s.repo.IncreaseViews(ctx, id)
}

func (s *Service) visibleDetail(ctx context.Context, viewer actor.Actor, id int) (Detail, error) {
	detail, err := s.repo.Detail(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	if !viewer.IncludesRated() && detail.Rated() {
		return Detail{}, ErrNotFound
	}
	return detail.visibleTo(viewer), nil
}

func (s *Service) ordered(ctx context.Context, ids []int, viewer actor.Actor) ([]Card, error) {
	byID, err := s.cards.ByIDs(ctx, ids, viewer)
	if err != nil {
		return nil, err
	}
	cards := make([]Card, 0, len(ids))
	for _, id := range ids {
		card, ok := byID[id]
		if !ok {
			card = Card{ID: id}
		}
		cards = append(cards, card)
	}
	return cards, nil
}

func nonZero(id *int) *int {
	if id == nil || *id == 0 {
		return nil
	}
	return id
}
