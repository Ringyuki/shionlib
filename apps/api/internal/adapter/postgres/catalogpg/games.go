package catalogpg

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsourcelink"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameimage"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamelink"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamerelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gametagrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/tag"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

func (s *Store) ApplyGame(ctx context.Context, source string, record catalog.GameRecord, creatorID int, at time.Time) (int, []catalog.Ref, error) {
	ref := catalog.Ref{Source: source, Entity: catalog.EntityGame, ExternalID: record.ExternalID}
	gameID, err := s.resolveGame(ctx, ref, record, creatorID)
	if err != nil {
		return 0, nil, err
	}
	if err := s.updateGame(ctx, gameID, record); err != nil {
		return 0, nil, err
	}
	if err := s.replaceMedia(ctx, gameID, source, record); err != nil {
		return 0, nil, err
	}
	if err := s.replaceLinks(ctx, gameID, record.Links); err != nil {
		return 0, nil, err
	}
	if err := s.replaceTags(ctx, gameID, record.Tags); err != nil {
		return 0, nil, err
	}
	var related []catalog.Ref
	developerRefs, err := s.replaceDevelopers(ctx, gameID, source, record.Developers)
	if err != nil {
		return 0, nil, err
	}
	related = append(related, developerRefs...)
	characterRefs, err := s.replaceCharacters(ctx, gameID, source, record.Characters)
	if err != nil {
		return 0, nil, err
	}
	related = append(related, characterRefs...)
	if err := s.replaceRelations(ctx, gameID, source, record.Relations); err != nil {
		return 0, nil, err
	}
	if err := s.saveLink(ctx, ref, gameID, record.Revision, at); err != nil {
		return 0, nil, err
	}
	return gameID, related, nil
}

func (s *Store) resolveGame(ctx context.Context, ref catalog.Ref, record catalog.GameRecord, creatorID int) (int, error) {
	id, _, ok, err := s.linked(ctx, ref, s.gameExists)
	if err != nil || ok {
		return id, err
	}
	if record.HikarinagiID != nil {
		row, err := s.db(ctx).Game.Query().Where(entgame.HID(*record.HikarinagiID)).Only(ctx)
		if err == nil {
			return s.claimLink(ctx, ref, row.ID)
		}
		if !ent.IsNotFound(err) {
			return 0, fmt.Errorf("find game by hikarinagi id: %w", err)
		}
	}
	if id, ok, err := s.adoptUnlinkedGame(ctx, ref.Source, record); err != nil || ok {
		if err != nil {
			return 0, err
		}
		return s.claimLink(ctx, ref, id)
	}
	created, err := s.db(ctx).Game.Create().SetCreatorID(creatorID).SetNillableHID(record.HikarinagiID).Save(ctx)
	if err != nil {
		return 0, fmt.Errorf("create game: %w", err)
	}
	claimed, err := s.claimLink(ctx, ref, created.ID)
	if err != nil {
		return 0, err
	}
	if claimed != created.ID {
		if err := s.db(ctx).Game.DeleteOneID(created.ID).Exec(ctx); err != nil {
			return 0, fmt.Errorf("discard duplicate game: %w", err)
		}
	}
	return claimed, nil
}

func (s *Store) gameExists(ctx context.Context, id int) (bool, error) {
	return s.db(ctx).Game.Query().Where(entgame.ID(id)).Exist(ctx)
}

func (s *Store) adoptUnlinkedGame(ctx context.Context, source string, record catalog.GameRecord) (int, bool, error) {
	var matches []predicate.Game
	if record.BID != nil {
		matches = append(matches, entgame.BID(*record.BID))
	}
	if record.VID != nil {
		matches = append(matches, entgame.VID(*record.VID))
	}
	if len(matches) == 0 {
		return 0, false, nil
	}
	candidates, err := s.db(ctx).Game.Query().
		Where(entgame.Or(matches...), unlinked(source, catalog.EntityGame)).
		Limit(2).
		IDs(ctx)
	if err != nil {
		return 0, false, fmt.Errorf("find unlinked game: %w", err)
	}
	if len(candidates) != 1 {
		return 0, false, nil
	}
	return candidates[0], true, nil
}

func unlinked(source string, entity catalog.Entity) func(*sql.Selector) {
	return func(selector *sql.Selector) {
		links := sql.Table(catalogsourcelink.Table)
		selector.Where(sql.NotExists(
			sql.Select(links.C(catalogsourcelink.FieldID)).From(links).Where(sql.And(
				sql.ColumnsEQ(links.C(catalogsourcelink.FieldLocalID), selector.C("id")),
				sql.EQ(links.C(catalogsourcelink.FieldSource), source),
				sql.EQ(links.C(catalogsourcelink.FieldEntity), string(entity)),
			)),
		))
	}
}

func (s *Store) updateGame(ctx context.Context, gameID int, record catalog.GameRecord) error {
	staffs, err := json.Marshal(nonNilStaff(record.Staffs))
	if err != nil {
		return fmt.Errorf("encode staffs: %w", err)
	}
	update := s.db(ctx).Game.UpdateOneID(gameID).
		SetTitleJp(record.TitleJP).
		SetTitleZh(record.TitleZH).
		SetTitleEn(record.TitleEN).
		SetIntroJp(record.IntroJP).
		SetIntroZh(record.IntroZH).
		SetIntroEn(record.IntroEN).
		SetAliases(pgvalue.Strings(record.Aliases)).
		SetReleaseDateTba(record.ReleaseDateTBA).
		SetNillableType(record.Type).
		SetPlatform(pgvalue.Strings(record.Platforms)).
		SetNsfw(record.NSFW).
		SetStaffs(staffs)
	if record.ReleaseDate != nil {
		update.SetReleaseDate(record.ReleaseDate.UTC())
	} else {
		update.ClearReleaseDate()
	}
	if record.Type == nil {
		update.ClearType()
	}
	if record.HikarinagiID != nil {
		taken, err := s.db(ctx).Game.Query().Where(entgame.HID(*record.HikarinagiID), entgame.IDNEQ(gameID)).Exist(ctx)
		if err != nil {
			return fmt.Errorf("check hikarinagi id: %w", err)
		}
		if !taken {
			update.SetHID(*record.HikarinagiID)
		}
	}
	if record.BID != nil || record.VID != nil {
		current, err := s.db(ctx).Game.Query().Where(entgame.ID(gameID)).Select(entgame.FieldBID, entgame.FieldVID).Only(ctx)
		if err != nil {
			return fmt.Errorf("load external ids: %w", err)
		}
		bid, vid := firstNonNil(record.BID, current.BID), firstNonNil(record.VID, current.VID)
		taken, err := s.db(ctx).Game.Query().Where(entgame.IDNEQ(gameID), equalOrNull[predicate.Game](entgame.FieldBID, bid), equalOrNull[predicate.Game](entgame.FieldVID, vid)).Exist(ctx)
		if err != nil {
			return fmt.Errorf("check external ids: %w", err)
		}
		if !taken {
			update.SetNillableBID(bid).SetNillableVID(vid)
		}
	}
	if err := update.Exec(ctx); err != nil {
		return fmt.Errorf("update game %d: %w", gameID, err)
	}
	return nil
}

func equalOrNull[P ~func(*sql.Selector)](column string, value *string) P {
	return func(selector *sql.Selector) {
		if value == nil {
			selector.Where(sql.IsNull(selector.C(column)))
			return
		}
		selector.Where(sql.EQ(selector.C(column), *value))
	}
}

func (s *Store) replaceMedia(ctx context.Context, gameID int, source string, record catalog.GameRecord) error {
	db := s.db(ctx)
	if _, err := db.GameCover.Delete().Where(gamecover.GameID(gameID)).Exec(ctx); err != nil {
		return fmt.Errorf("clear covers: %w", err)
	}
	if len(record.Covers) > 0 {
		builders := make([]*ent.GameCoverCreate, len(record.Covers))
		for i, cover := range record.Covers {
			builders[i] = db.GameCover.Create().
				SetGameID(gameID).
				SetLanguage(cover.Language).
				SetType(cover.Type).
				SetURL(cover.URL).
				SetDims(pgvalue.Ints(cover.Dims)).
				SetSexual(cover.Sexual).
				SetViolence(cover.Violence).
				SetSource(source).
				SetSourceKey(cover.SourceKey).
				SetSourceURL(cover.URL)
		}
		if err := db.GameCover.CreateBulk(builders...).Exec(ctx); err != nil {
			return fmt.Errorf("insert covers: %w", err)
		}
	}
	if _, err := db.GameImage.Delete().Where(gameimage.GameID(gameID)).Exec(ctx); err != nil {
		return fmt.Errorf("clear images: %w", err)
	}
	if len(record.Images) > 0 {
		builders := make([]*ent.GameImageCreate, len(record.Images))
		for i, image := range record.Images {
			builders[i] = db.GameImage.Create().
				SetGameID(gameID).
				SetURL(image.URL).
				SetDims(pgvalue.Ints(image.Dims)).
				SetSexual(image.Sexual).
				SetViolence(image.Violence).
				SetSource(source).
				SetSourceKey(image.SourceKey).
				SetSourceURL(image.URL)
		}
		if err := db.GameImage.CreateBulk(builders...).Exec(ctx); err != nil {
			return fmt.Errorf("insert images: %w", err)
		}
	}
	return nil
}

func (s *Store) replaceLinks(ctx context.Context, gameID int, links []catalog.Link) error {
	db := s.db(ctx)
	if _, err := db.GameLink.Delete().Where(gamelink.GameID(gameID)).Exec(ctx); err != nil {
		return fmt.Errorf("clear links: %w", err)
	}
	if len(links) == 0 {
		return nil
	}
	builders := make([]*ent.GameLinkCreate, len(links))
	for i, link := range links {
		builders[i] = db.GameLink.Create().SetGameID(gameID).SetName(link.Name).SetLabel(link.Label).SetURL(link.URL)
	}
	if err := db.GameLink.CreateBulk(builders...).Exec(ctx); err != nil {
		return fmt.Errorf("insert links: %w", err)
	}
	return nil
}

func (s *Store) replaceTags(ctx context.Context, gameID int, names []string) error {
	db := s.db(ctx)
	previous, err := db.GameTagRelation.Query().Where(gametagrelation.GameID(gameID)).Select(gametagrelation.FieldTagID).Ints(ctx)
	if err != nil {
		return fmt.Errorf("load tag relations: %w", err)
	}
	if _, err := db.GameTagRelation.Delete().Where(gametagrelation.GameID(gameID)).Exec(ctx); err != nil {
		return fmt.Errorf("clear tag relations: %w", err)
	}
	var current []int
	if len(names) > 0 {
		builders := make([]*ent.TagCreate, len(names))
		for i, name := range names {
			builders[i] = db.Tag.Create().SetName(name)
		}
		if err := db.Tag.CreateBulk(builders...).OnConflict(sql.ConflictColumns(tag.FieldName)).DoNothing().Exec(ctx); err != nil && !ent.IsNotFound(err) {
			return fmt.Errorf("upsert tags: %w", err)
		}
		current, err = db.Tag.Query().Where(tag.NameIn(names...)).IDs(ctx)
		if err != nil {
			return fmt.Errorf("load tag ids: %w", err)
		}
		relations := make([]*ent.GameTagRelationCreate, len(current))
		for i, id := range current {
			relations[i] = db.GameTagRelation.Create().SetGameID(gameID).SetTagID(id)
		}
		if err := db.GameTagRelation.CreateBulk(relations...).Exec(ctx); err != nil {
			return fmt.Errorf("insert tag relations: %w", err)
		}
	}
	affected := slices.Compact(slices.Sorted(slices.Values(append(previous, current...))))
	if len(affected) == 0 {
		return nil
	}
	_, err = db.ExecContext(ctx, `UPDATE tags SET count = (SELECT count(*) FROM game_tag_relations r WHERE r.tag_id = tags.id), updated = CURRENT_TIMESTAMP WHERE id = ANY($1)`, pgvalue.Ints(affected))
	if err != nil {
		return fmt.Errorf("recount tags: %w", err)
	}
	return nil
}

func (s *Store) replaceDevelopers(ctx context.Context, gameID int, source string, credits []catalog.DeveloperLink) ([]catalog.Ref, error) {
	db := s.db(ctx)
	if _, err := db.GameDeveloperRelation.Delete().Where(gamedeveloperrelation.GameID(gameID)).Exec(ctx); err != nil {
		return nil, fmt.Errorf("clear developer relations: %w", err)
	}
	var refs []catalog.Ref
	seen := map[int]bool{}
	for _, credit := range credits {
		developerID, needsSync, err := s.ensureDeveloper(ctx, source, credit)
		if err != nil {
			return nil, err
		}
		if seen[developerID] {
			continue
		}
		seen[developerID] = true
		if err := db.GameDeveloperRelation.Create().SetGameID(gameID).SetDeveloperID(developerID).SetRole(credit.Role).Exec(ctx); err != nil {
			return nil, fmt.Errorf("insert developer relation: %w", err)
		}
		if needsSync {
			refs = append(refs, catalog.Ref{Source: source, Entity: catalog.EntityDeveloper, ExternalID: credit.ExternalID})
		}
	}
	return refs, nil
}

func (s *Store) replaceCharacters(ctx context.Context, gameID int, source string, credits []catalog.CharacterLink) ([]catalog.Ref, error) {
	db := s.db(ctx)
	if _, err := db.GameCharacterRelation.Delete().Where(gamecharacterrelation.GameID(gameID)).Exec(ctx); err != nil {
		return nil, fmt.Errorf("clear character relations: %w", err)
	}
	var refs []catalog.Ref
	seen := map[int]bool{}
	for _, credit := range credits {
		characterID, needsSync, err := s.ensureCharacter(ctx, source, credit)
		if err != nil {
			return nil, err
		}
		if seen[characterID] {
			continue
		}
		seen[characterID] = true
		create := db.GameCharacterRelation.Create().
			SetGameID(gameID).
			SetCharacterID(characterID).
			SetRole(gamecharacterrelation.Role(credit.Role)).
			SetNillableImage(credit.Image).
			SetNillableActor(credit.Actor)
		if err := create.Exec(ctx); err != nil {
			return nil, fmt.Errorf("insert character relation: %w", err)
		}
		if needsSync {
			refs = append(refs, catalog.Ref{Source: source, Entity: catalog.EntityCharacter, ExternalID: credit.ExternalID})
		}
	}
	return refs, nil
}

func (s *Store) replaceRelations(ctx context.Context, gameID int, source string, relations []catalog.RelationLink) error {
	db := s.db(ctx)
	if _, err := db.GameRelation.Delete().Where(gamerelation.FromGameID(gameID)).Exec(ctx); err != nil {
		return fmt.Errorf("clear game relations: %w", err)
	}
	seen := map[int]bool{}
	for _, relation := range relations {
		targetID, ok, err := s.LocalID(ctx, catalog.Ref{Source: source, Entity: catalog.EntityGame, ExternalID: relation.ExternalID})
		if err != nil {
			return err
		}
		if !ok || targetID == gameID || seen[targetID] {
			continue
		}
		seen[targetID] = true
		if err := db.GameRelation.Create().SetFromGameID(gameID).SetToGameID(targetID).SetRelation(gamerelation.Relation(relation.Type)).Exec(ctx); err != nil {
			return fmt.Errorf("insert game relation: %w", err)
		}
	}
	return nil
}

func nonNilStaff(rows []catalog.Staff) []map[string]string {
	out := make([]map[string]string, 0, len(rows))
	for _, row := range rows {
		out = append(out, map[string]string{"name": row.Name, "role": row.Role})
	}
	return out
}

func firstNonNil(values ...*string) *string {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}
