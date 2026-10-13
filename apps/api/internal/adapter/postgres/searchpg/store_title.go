package searchpg

import (
	"context"
	"fmt"
	"strings"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

type TitleStore struct {
	client *ent.Client
}

func NewTitleStore(client *ent.Client) *TitleStore {
	return &TitleStore{client: client}
}

func (s *TitleStore) Titles(ctx context.Context, prefix string, visibility game.Visibility, limit int) ([]string, error) {
	rows, err := postgres.Client(ctx, s.client).Game.Query().
		Where(gamepg.ListablePredicates(visibility)...).
		Where(titledWith(prefix)).
		Order(entgame.ByHotScore(sql.OrderDesc()), entgame.ByID()).
		Limit(limit).
		Select(entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn, entgame.FieldAliases).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("suggest titles: %w", err)
	}
	lowered := strings.ToLower(prefix)
	titles := make([]string, 0, len(rows))
	seen := map[string]bool{}
	for _, row := range rows {
		for _, candidate := range append([]string{row.TitleJp, row.TitleZh, row.TitleEn}, row.Aliases...) {
			key := strings.ToLower(candidate)
			if strings.HasPrefix(key, lowered) {
				if !seen[key] {
					seen[key] = true
					titles = append(titles, candidate)
				}
				break
			}
		}
	}
	return titles, nil
}

func titledWith(prefix string) predicate.Game {
	pattern := likeEscaper.Replace(prefix) + "%"
	return predicate.Game(func(s *sql.Selector) {
		s.Where(sql.Or(
			startsWithFold(s.C(entgame.FieldTitleJp), pattern),
			startsWithFold(s.C(entgame.FieldTitleZh), pattern),
			startsWithFold(s.C(entgame.FieldTitleEn), pattern),
			sql.P(func(b *sql.Builder) {
				b.WriteString("EXISTS (SELECT 1 FROM unnest(").WriteString(s.C(entgame.FieldAliases)).WriteString(") AS alias(value) WHERE alias.value ILIKE ").Arg(pattern).WriteString(")")
			}),
		))
	})
}

func startsWithFold(column, pattern string) *sql.Predicate {
	return sql.P(func(b *sql.Builder) {
		b.WriteString(column).WriteString(" ILIKE ").Arg(pattern)
	})
}
