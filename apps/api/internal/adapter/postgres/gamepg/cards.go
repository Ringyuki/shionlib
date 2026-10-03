package gamepg

import (
	"context"
	"fmt"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const developerRole = "开发"

type CardStore struct {
	client *ent.Client
}

func NewCardStore(client *ent.Client) *CardStore {
	return &CardStore{client: client}
}

func (s *CardStore) Cards(ctx context.Context, ids []int) ([]game.Card, error) {
	rows, err := postgres.Client(ctx, s.client).Game.Query().
		Where(entgame.IDIn(ids...)).
		WithCovers(func(q *ent.GameCoverQuery) {
			q.Order(ent.Asc(gamecover.FieldID))
		}).
		WithDevelopers(func(q *ent.GameDeveloperRelationQuery) {
			q.Where(gamedeveloperrelation.RoleEQ(developerRole)).Order(ent.Asc(gamedeveloperrelation.FieldID)).WithDeveloper()
		}).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load game cards: %w", err)
	}
	cards := make([]game.Card, 0, len(rows))
	for _, row := range rows {
		cards = append(cards, toCard(row))
	}
	return cards, nil
}

func (s *CardStore) Exists(ctx context.Context, id int) (bool, error) {
	exists, err := postgres.Client(ctx, s.client).Game.Query().Where(entgame.ID(id)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check game existence: %w", err)
	}
	return exists, nil
}

func toCard(row *ent.Game) game.Card {
	card := game.Card{
		ID:          row.ID,
		Views:       row.Views,
		TitleJP:     row.TitleJp,
		TitleZH:     row.TitleZh,
		TitleEN:     row.TitleEn,
		Aliases:     nonNil(row.Aliases),
		Type:        row.Type,
		IntroJP:     row.IntroJp,
		IntroZH:     row.IntroZh,
		IntroEN:     row.IntroEn,
		ReleaseDate: row.ReleaseDate,
		Covers:      make([]game.Cover, 0, len(row.Edges.Covers)),
		Developers:  make([]game.Credit, 0, len(row.Edges.Developers)),
	}
	for _, cover := range row.Edges.Covers {
		card.Covers = append(card.Covers, game.Cover{
			Language: cover.Language,
			Type:     cover.Type,
			URL:      cover.URL,
			Dims:     nonNilInts(cover.Dims),
			Sexual:   cover.Sexual,
			Violence: cover.Violence,
		})
	}
	for _, relation := range row.Edges.Developers {
		developer := relation.Edges.Developer
		if developer == nil {
			continue
		}
		role := developerRole
		if relation.Role != nil {
			role = *relation.Role
		}
		card.Developers = append(card.Developers, game.Credit{
			Role:      role,
			Developer: game.DeveloperRef{ID: developer.ID, Name: developer.Name, Aliases: nonNil(developer.Aliases)},
		})
	}
	return card
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return slices.Clone(values)
}

func nonNilInts(values []int) []int {
	if values == nil {
		return []int{}
	}
	return slices.Clone(values)
}
