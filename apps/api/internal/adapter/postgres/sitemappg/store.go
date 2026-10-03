package sitemappg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloper"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
)

type Store struct {
	client *ent.Client
}

func NewStore(client *ent.Client) *Store {
	return &Store{client: client}
}

func (s *Store) Count(ctx context.Context, section sitemap.Section) (int, error) {
	db := postgres.Client(ctx, s.client)
	var (
		count int
		err   error
	)
	switch section {
	case sitemap.SectionGame:
		count, err = db.Game.Query().Where(gamepg.ListablePredicates(game.Visibility{ExcludeRated: true})...).Count(ctx)
	case sitemap.SectionDeveloper:
		count, err = db.GameDeveloper.Query().Count(ctx)
	case sitemap.SectionCharacter:
		count, err = db.GameCharacter.Query().Count(ctx)
	}
	if err != nil {
		return 0, fmt.Errorf("count sitemap %s entries: %w", section, err)
	}
	return count, nil
}

func (s *Store) Entries(ctx context.Context, section sitemap.Section, offset, limit int) ([]sitemap.Entry, error) {
	db := postgres.Client(ctx, s.client)
	entries := []sitemap.Entry{}
	switch section {
	case sitemap.SectionGame:
		games, err := db.Game.Query().Where(gamepg.ListablePredicates(game.Visibility{ExcludeRated: true})...).
			Order(entgame.ByID()).Offset(offset).Limit(limit).Select(entgame.FieldID, entgame.FieldUpdated).All(ctx)
		if err != nil {
			return nil, fmt.Errorf("list sitemap games: %w", err)
		}
		for _, row := range games {
			entries = append(entries, sitemap.Entry{ID: row.ID, Updated: row.Updated})
		}
	case sitemap.SectionDeveloper:
		developers, err := db.GameDeveloper.Query().
			Order(gamedeveloper.ByID()).Offset(offset).Limit(limit).Select(gamedeveloper.FieldID, gamedeveloper.FieldUpdated).All(ctx)
		if err != nil {
			return nil, fmt.Errorf("list sitemap developers: %w", err)
		}
		for _, row := range developers {
			entries = append(entries, sitemap.Entry{ID: row.ID, Updated: row.Updated})
		}
	case sitemap.SectionCharacter:
		characters, err := db.GameCharacter.Query().
			Order(gamecharacter.ByID()).Offset(offset).Limit(limit).Select(gamecharacter.FieldID, gamecharacter.FieldUpdated).All(ctx)
		if err != nil {
			return nil, fmt.Errorf("list sitemap characters: %w", err)
		}
		for _, row := range characters {
			entries = append(entries, sitemap.Entry{ID: row.ID, Updated: row.Updated})
		}
	}
	return entries, nil
}
