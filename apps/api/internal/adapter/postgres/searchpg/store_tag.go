package searchpg

import (
	"context"
	"fmt"
	"slices"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/tag"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

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
