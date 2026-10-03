package searchpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

type DocumentStore struct {
	client *ent.Client
}

func NewDocumentStore(client *ent.Client) *DocumentStore {
	return &DocumentStore{client: client}
}

func (d *DocumentStore) DocumentIDs(ctx context.Context, afterID, limit int) ([]int, error) {
	ids, err := d.client.Game.Query().
		Where(entgame.IDGT(afterID)).
		Order(ent.Asc(entgame.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list game ids for indexing: %w", err)
	}
	return ids, nil
}

func (d *DocumentStore) Documents(ctx context.Context, ids []int) ([]search.Document, error) {
	rows, err := d.client.Game.Query().
		Where(entgame.IDIn(ids...)).
		Order(ent.Asc(entgame.FieldID)).
		WithCovers().
		WithTagRelations(func(q *ent.GameTagRelationQuery) { q.WithTag() }).
		WithDevelopers(func(q *ent.GameDeveloperRelationQuery) { q.WithDeveloper() }).
		WithCharacters(func(q *ent.GameCharacterRelationQuery) { q.WithCharacter() }).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load games for indexing: %w", err)
	}
	docs := make([]search.Document, len(rows))
	for i, row := range rows {
		docs[i] = toDocument(row)
	}
	return docs, nil
}
