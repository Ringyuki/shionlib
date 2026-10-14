package openpg

import (
	"context"
	"fmt"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/open"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) Find(ctx context.Context, kind open.Kind, values []string) ([]open.Game, error) {
	matching, err := lookupOf(kind, values)
	if err != nil {
		return nil, err
	}
	rows, err := postgres.Client(ctx, r.client).Game.Query().
		Where(matching, entgame.Status(int(game.StatusVisible))).
		Select(entgame.FieldID, entgame.FieldHID, entgame.FieldBID, entgame.FieldVID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn, entgame.FieldNsfw).
		Order(ent.Asc(entgame.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("find games by %s: %w", kind, err)
	}
	games := make([]open.Game, len(rows))
	for i, row := range rows {
		games[i] = open.Game{
			ID:      row.ID,
			HID:     row.HID,
			BID:     row.BID,
			VID:     row.VID,
			TitleJP: row.TitleJp,
			TitleZH: row.TitleZh,
			TitleEN: row.TitleEn,
			NSFW:    row.Nsfw,
		}
	}
	return games, nil
}

func lookupOf(kind open.Kind, values []string) (predicate.Game, error) {
	switch kind {
	case open.KindID, open.KindHID:
		numbers := make([]int, len(values))
		for i, value := range values {
			number, err := strconv.Atoi(value)
			if err != nil {
				return nil, fmt.Errorf("read game number %q: %w", value, err)
			}
			numbers[i] = number
		}
		if kind == open.KindID {
			return entgame.IDIn(numbers...), nil
		}
		return entgame.HIDIn(numbers...), nil
	case open.KindBID:
		return entgame.BIDIn(values...), nil
	default:
		return entgame.VIDIn(values...), nil
	}
}
