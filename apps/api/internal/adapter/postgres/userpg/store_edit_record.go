package userpg

import (
	"context"
	"fmt"
	"slices"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/editrecord"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloper"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type EditRecordStore struct {
	client *ent.Client
}

func NewEditRecordStore(client *ent.Client) *EditRecordStore {
	return &EditRecordStore{client: client}
}

func (s *EditRecordStore) ListByActor(ctx context.Context, actorID int, viewer actor.Actor, page user.Page) ([]user.EditRecord, int, error) {
	db := postgres.Client(ctx, s.client)
	query := db.EditRecord.Query().Where(editrecord.ActorID(actorID))
	if !viewer.IncludesRated() {
		query.Where(targetsSafeGames())
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count edit records: %w", err)
	}
	rows, err := query.
		Order(ent.Desc(editrecord.FieldCreated), ent.Desc(editrecord.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list edit records: %w", err)
	}
	records := make([]user.EditRecord, len(rows))
	targets := map[editrecord.Entity][]int{}
	for i, row := range rows {
		records[i] = toEditRecord(row)
		targets[row.Entity] = append(targets[row.Entity], row.TargetID)
	}
	games, err := s.games(ctx, db, targets[editrecord.EntityGame])
	if err != nil {
		return nil, 0, err
	}
	characters, err := s.characters(ctx, db, targets[editrecord.EntityCharacter])
	if err != nil {
		return nil, 0, err
	}
	developers, err := s.developers(ctx, db, targets[editrecord.EntityDeveloper])
	if err != nil {
		return nil, 0, err
	}
	for i := range records {
		switch records[i].Entity {
		case user.EditedGameEntity:
			records[i].Game = games[records[i].TargetID]
		case user.EditedCharacterEntity:
			records[i].Character = characters[records[i].TargetID]
		case user.EditedDeveloperEntity:
			records[i].Developer = developers[records[i].TargetID]
		}
	}
	return records, total, nil
}

func targetsSafeGames() predicate.EditRecord {
	return func(s *entsql.Selector) {
		safe := entsql.Select(entgame.FieldID).From(entsql.Table(entgame.Table))
		gamepg.SafeForStrictViewers()(safe)
		s.Where(entsql.Or(
			entsql.NEQ(s.C(editrecord.FieldEntity), string(editrecord.EntityGame)),
			entsql.In(s.C(editrecord.FieldTargetID), safe),
		))
	}
}

func (s *EditRecordStore) games(ctx context.Context, db *ent.Client, ids []int) (map[int]*user.EditedGame, error) {
	out := map[int]*user.EditedGame{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := db.Game.Query().
		Where(entgame.IDIn(dedupe(ids)...)).
		WithCovers(func(q *ent.GameCoverQuery) { q.Order(ent.Asc(gamecover.FieldID)) }).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load edited games: %w", err)
	}
	for _, row := range rows {
		edited := &user.EditedGame{
			ID:      row.ID,
			TitleJP: row.TitleJp,
			TitleZH: row.TitleZh,
			TitleEN: row.TitleEn,
			IntroJP: row.IntroJp,
			IntroZH: row.IntroZh,
			IntroEN: row.IntroEn,
			Covers:  make([]user.EditedCover, 0, len(row.Edges.Covers)),
		}
		for _, cover := range row.Edges.Covers {
			dims := []int(cover.Dims)
			if dims == nil {
				dims = []int{}
			}
			edited.Covers = append(edited.Covers, user.EditedCover{URL: cover.URL, Language: cover.Language, Dims: dims, Sexual: cover.Sexual, Violence: cover.Violence})
		}
		out[row.ID] = edited
	}
	return out, nil
}

func (s *EditRecordStore) characters(ctx context.Context, db *ent.Client, ids []int) (map[int]*user.EditedCharacter, error) {
	out := map[int]*user.EditedCharacter{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := db.GameCharacter.Query().Where(gamecharacter.IDIn(dedupe(ids)...)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load edited characters: %w", err)
	}
	for _, row := range rows {
		out[row.ID] = &user.EditedCharacter{ID: row.ID, NameJP: row.NameJp, NameZH: row.NameZh, NameEN: row.NameEn}
	}
	return out, nil
}

func (s *EditRecordStore) developers(ctx context.Context, db *ent.Client, ids []int) (map[int]*user.EditedDeveloper, error) {
	out := map[int]*user.EditedDeveloper{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := db.GameDeveloper.Query().Where(gamedeveloper.IDIn(dedupe(ids)...)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load edited developers: %w", err)
	}
	for _, row := range rows {
		aliases := []string(row.Aliases)
		if aliases == nil {
			aliases = []string{}
		}
		out[row.ID] = &user.EditedDeveloper{ID: row.ID, Name: row.Name, Aliases: aliases}
	}
	return out, nil
}

func dedupe(ids []int) []int {
	out := slices.Clone(ids)
	slices.Sort(out)
	return slices.Compact(out)
}
