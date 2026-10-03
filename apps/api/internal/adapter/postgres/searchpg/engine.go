package searchpg

import (
	"context"
	"fmt"
	"slices"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloper"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/tag"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type Engine struct {
	client *ent.Client
}

func NewEngine(client *ent.Client) *Engine {
	return &Engine{client: client}
}

func (e *Engine) Search(ctx context.Context, criteria search.Criteria) (search.Result, error) {
	query := postgres.Client(ctx, e.client).Game.Query().
		Where(gamepg.ListablePredicates(game.Visibility{ExcludeRated: criteria.ExcludeRated, OnlyWithResources: criteria.OnlyWithResources})...)
	if criteria.Tag != "" {
		query.Where(entgame.HasTagsWith(tag.NameEqualFold(criteria.Tag)))
	}
	if criteria.Q != "" {
		query.Where(matchingGame(criteria.Q))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return search.Result{}, fmt.Errorf("count search hits: %w", err)
	}
	ids, err := query.
		Order(entgame.ByReleaseDate(sql.OrderDesc(), sql.OrderNullsLast()), entgame.ByID(sql.OrderDesc())).
		Offset((criteria.Page.Number - 1) * criteria.Page.Size).
		Limit(criteria.Page.Size).
		IDs(ctx)
	if err != nil {
		return search.Result{}, fmt.Errorf("search games: %w", err)
	}
	hits := make([]search.Hit, len(ids))
	for i, id := range ids {
		hits[i] = search.Hit{GameID: id}
	}
	totalPages := 0
	if criteria.Page.Size > 0 {
		totalPages = (total + criteria.Page.Size - 1) / criteria.Page.Size
	}
	return search.Result{Hits: hits, Total: total, TotalPages: totalPages}, nil
}

func matchingGame(q string) predicate.Game {
	return entgame.Or(
		predicate.Game(func(s *sql.Selector) {
			s.Where(sql.Or(
				sql.ContainsFold(s.C(entgame.FieldTitleJp), q),
				sql.ContainsFold(s.C(entgame.FieldTitleZh), q),
				sql.ContainsFold(s.C(entgame.FieldTitleEn), q),
				gamepg.AnyElementContainsFold(s.C(entgame.FieldAliases), q),
			))
		}),
		entgame.HasTagsWith(matchingTag(q)),
		entgame.HasDevelopersWith(gamedeveloperrelation.HasDeveloperWith(matchingDeveloper(q))),
	)
}

func matchingTag(q string) predicate.Tag {
	return predicate.Tag(func(s *sql.Selector) {
		s.Where(sql.Or(
			sql.ContainsFold(s.C(tag.FieldName), q),
			gamepg.AnyElementContainsFold(s.C(tag.FieldAliases), q),
		))
	})
}

func matchingDeveloper(q string) predicate.GameDeveloper {
	return predicate.GameDeveloper(func(s *sql.Selector) {
		s.Where(sql.Or(
			sql.ContainsFold(s.C(gamedeveloper.FieldName), q),
			gamepg.AnyElementContainsFold(s.C(gamedeveloper.FieldAliases), q),
		))
	})
}

type TagStore struct {
	client *ent.Client
}

func NewTagStore(client *ent.Client) *TagStore {
	return &TagStore{client: client}
}

func (s *TagStore) Tags(ctx context.Context, query string, limit int) ([]search.Tag, error) {
	q := postgres.Client(ctx, s.client).Tag.Query()
	if query != "" {
		q.Where(matchingTag(query))
	}
	rows, err := q.Order(tag.ByCount(sql.OrderDesc()), tag.ByID()).Limit(limit).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("search tags: %w", err)
	}
	tags := make([]search.Tag, len(rows))
	for i, row := range rows {
		aliases := slices.Clone([]string(row.Aliases))
		if aliases == nil {
			aliases = []string{}
		}
		tags[i] = search.Tag{ID: row.ID, Name: row.Name, Count: row.Count, Aliases: aliases}
	}
	return tags, nil
}
