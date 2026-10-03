package catalogpg

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloper"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

func (s *Store) ensureDeveloper(ctx context.Context, source string, credit catalog.DeveloperLink) (int, bool, error) {
	ref := catalog.Ref{Source: source, Entity: catalog.EntityDeveloper, ExternalID: credit.ExternalID}
	id, synced, ok, err := s.linked(ctx, ref, s.developerExists)
	if err != nil || ok {
		return id, !synced, err
	}
	id, fresh, err := s.createDeveloper(ctx, credit.HikarinagiID, credit.Name, credit.Aliases, credit.Logo)
	if err != nil {
		return 0, false, err
	}
	id, err = s.claimDeveloper(ctx, ref, id, fresh)
	return id, true, err
}

func (s *Store) ApplyDeveloper(ctx context.Context, source string, record catalog.DeveloperRecord, at time.Time) (int, error) {
	ref := catalog.Ref{Source: source, Entity: catalog.EntityDeveloper, ExternalID: record.ExternalID}
	id, _, ok, err := s.linked(ctx, ref, s.developerExists)
	if err != nil {
		return 0, err
	}
	if !ok {
		if id, err = s.adoptDeveloper(ctx, ref, record); err != nil {
			return 0, err
		}
	}
	extra, err := json.Marshal(nonNilExtra(record.Extra))
	if err != nil {
		return 0, fmt.Errorf("encode developer extra info: %w", err)
	}
	update := s.db(ctx).GameDeveloper.UpdateOneID(id).
		SetName(record.Name).
		SetAliases(pgvalue.Strings(record.Aliases)).
		SetIntroJp(record.IntroJP).
		SetIntroZh(record.IntroZH).
		SetIntroEn(record.IntroEN).
		SetExtraInfo(extra)
	if record.Logo != nil {
		update.SetLogo(*record.Logo)
	} else {
		update.ClearLogo()
	}
	if record.Website != nil {
		update.SetWebsite(*record.Website)
	} else {
		update.ClearWebsite()
	}
	if record.HikarinagiID != nil {
		taken, err := s.db(ctx).GameDeveloper.Query().Where(gamedeveloper.HID(*record.HikarinagiID), gamedeveloper.IDNEQ(id)).Exist(ctx)
		if err != nil {
			return 0, fmt.Errorf("check developer hikarinagi id: %w", err)
		}
		if !taken {
			update.SetHID(*record.HikarinagiID)
		}
	}
	if record.BID != nil || record.VID != nil {
		current, err := s.db(ctx).GameDeveloper.Query().Where(gamedeveloper.ID(id)).Select(gamedeveloper.FieldBID, gamedeveloper.FieldVID).Only(ctx)
		if err != nil {
			return 0, fmt.Errorf("load developer external ids: %w", err)
		}
		bid, vid := firstNonNil(record.BID, current.BID), firstNonNil(record.VID, current.VID)
		taken, err := s.db(ctx).GameDeveloper.Query().Where(gamedeveloper.IDNEQ(id), equalOrNull[predicate.GameDeveloper](gamedeveloper.FieldBID, bid), equalOrNull[predicate.GameDeveloper](gamedeveloper.FieldVID, vid)).Exist(ctx)
		if err != nil {
			return 0, fmt.Errorf("check developer external ids: %w", err)
		}
		if !taken {
			update.SetNillableBID(bid).SetNillableVID(vid)
		}
	}
	if err := update.Exec(ctx); err != nil {
		return 0, fmt.Errorf("update developer %d: %w", id, err)
	}
	if err := s.saveLink(ctx, ref, id, record.Revision, at); err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) adoptDeveloper(ctx context.Context, ref catalog.Ref, record catalog.DeveloperRecord) (int, error) {
	if record.HikarinagiID == nil {
		var matches []predicate.GameDeveloper
		if record.BID != nil {
			matches = append(matches, gamedeveloper.BID(*record.BID))
		}
		if record.VID != nil {
			matches = append(matches, gamedeveloper.VID(*record.VID))
		}
		if len(matches) > 0 {
			candidates, err := s.db(ctx).GameDeveloper.Query().
				Where(gamedeveloper.Or(matches...), unlinked(ref.Source, catalog.EntityDeveloper)).
				Limit(2).
				IDs(ctx)
			if err != nil {
				return 0, fmt.Errorf("find unlinked developer: %w", err)
			}
			if len(candidates) == 1 {
				return s.claimDeveloper(ctx, ref, candidates[0], false)
			}
		}
	}
	id, fresh, err := s.createDeveloper(ctx, record.HikarinagiID, record.Name, record.Aliases, record.Logo)
	if err != nil {
		return 0, err
	}
	return s.claimDeveloper(ctx, ref, id, fresh)
}

func (s *Store) createDeveloper(ctx context.Context, hikarinagiID *int, name string, aliases []string, logo *string) (int, bool, error) {
	create := s.db(ctx).GameDeveloper.Create().
		SetName(name).
		SetAliases(pgvalue.Strings(aliases)).
		SetNillableLogo(logo)
	if hikarinagiID != nil {
		id, err := create.SetHID(*hikarinagiID).OnConflictColumns(gamedeveloper.FieldHID).Ignore().ID(ctx)
		if err != nil {
			return 0, false, fmt.Errorf("upsert developer: %w", err)
		}
		return id, false, nil
	}
	row, err := create.Save(ctx)
	if err != nil {
		return 0, false, fmt.Errorf("create developer: %w", err)
	}
	return row.ID, true, nil
}

func (s *Store) claimDeveloper(ctx context.Context, ref catalog.Ref, id int, fresh bool) (int, error) {
	claimed, err := s.claimLink(ctx, ref, id)
	if err != nil {
		return 0, err
	}
	if claimed != id && fresh {
		if err := s.db(ctx).GameDeveloper.DeleteOneID(id).Exec(ctx); err != nil {
			return 0, fmt.Errorf("discard duplicate developer: %w", err)
		}
	}
	return claimed, nil
}

func (s *Store) developerExists(ctx context.Context, id int) (bool, error) {
	return s.db(ctx).GameDeveloper.Query().Where(gamedeveloper.ID(id)).Exist(ctx)
}

func (s *Store) ensureCharacter(ctx context.Context, source string, credit catalog.CharacterLink) (int, bool, error) {
	ref := catalog.Ref{Source: source, Entity: catalog.EntityCharacter, ExternalID: credit.ExternalID}
	id, synced, ok, err := s.linked(ctx, ref, s.characterExists)
	if err != nil || ok {
		return id, !synced, err
	}
	seed := catalog.CharacterRecord{HikarinagiID: credit.HikarinagiID, NameJP: credit.NameJP, NameZH: credit.NameZH, NameEN: credit.NameEN, Image: credit.Image}
	id, fresh, err := s.createCharacter(ctx, seed)
	if err != nil {
		return 0, false, err
	}
	id, err = s.claimCharacter(ctx, ref, id, fresh)
	return id, true, err
}

func (s *Store) ApplyCharacter(ctx context.Context, source string, record catalog.CharacterRecord, at time.Time) (int, error) {
	ref := catalog.Ref{Source: source, Entity: catalog.EntityCharacter, ExternalID: record.ExternalID}
	id, _, ok, err := s.linked(ctx, ref, s.characterExists)
	if err != nil {
		return 0, err
	}
	if !ok {
		if id, err = s.adoptCharacter(ctx, ref, record); err != nil {
			return 0, err
		}
	}
	update := s.db(ctx).GameCharacter.UpdateOneID(id).
		SetNameJp(record.NameJP).
		SetAliases(pgvalue.Strings(record.Aliases)).
		SetIntroJp(record.IntroJP).
		SetIntroZh(record.IntroZH).
		SetIntroEn(record.IntroEN).
		SetBirthday(pgvalue.Ints(record.Birthday)).
		SetGender(pgvalue.Strings(record.Gender))
	setOrClear(record.NameZH, update.SetNameZh, update.ClearNameZh)
	setOrClear(record.NameEN, update.SetNameEn, update.ClearNameEn)
	setOrClear(record.Image, update.SetImage, update.ClearImage)
	setOrClear(record.Cup, update.SetCup, update.ClearCup)
	setOrClear(record.Height, update.SetHeight, update.ClearHeight)
	setOrClear(record.Weight, update.SetWeight, update.ClearWeight)
	setOrClear(record.Bust, update.SetBust, update.ClearBust)
	setOrClear(record.Waist, update.SetWaist, update.ClearWaist)
	setOrClear(record.Hips, update.SetHips, update.ClearHips)
	setOrClear(record.Age, update.SetAge, update.ClearAge)
	if record.BloodType != nil {
		update.SetBloodType(gamecharacter.BloodType(*record.BloodType))
	} else {
		update.ClearBloodType()
	}
	if record.HikarinagiID != nil {
		taken, err := s.db(ctx).GameCharacter.Query().Where(gamecharacter.HID(*record.HikarinagiID), gamecharacter.IDNEQ(id)).Exist(ctx)
		if err != nil {
			return 0, fmt.Errorf("check character hikarinagi id: %w", err)
		}
		if !taken {
			update.SetHID(*record.HikarinagiID)
		}
	}
	if record.BID != nil || record.VID != nil {
		current, err := s.db(ctx).GameCharacter.Query().Where(gamecharacter.ID(id)).Select(gamecharacter.FieldBID, gamecharacter.FieldVID).Only(ctx)
		if err != nil {
			return 0, fmt.Errorf("load character external ids: %w", err)
		}
		bid, vid := firstNonNil(record.BID, current.BID), firstNonNil(record.VID, current.VID)
		taken, err := s.db(ctx).GameCharacter.Query().Where(gamecharacter.IDNEQ(id), equalOrNull[predicate.GameCharacter](gamecharacter.FieldBID, bid), equalOrNull[predicate.GameCharacter](gamecharacter.FieldVID, vid)).Exist(ctx)
		if err != nil {
			return 0, fmt.Errorf("check character external ids: %w", err)
		}
		if !taken {
			update.SetNillableBID(bid).SetNillableVID(vid)
		}
	}
	if err := update.Exec(ctx); err != nil {
		return 0, fmt.Errorf("update character %d: %w", id, err)
	}
	if err := s.saveLink(ctx, ref, id, record.Revision, at); err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) adoptCharacter(ctx context.Context, ref catalog.Ref, record catalog.CharacterRecord) (int, error) {
	if record.HikarinagiID == nil {
		var matches []predicate.GameCharacter
		if record.BID != nil {
			matches = append(matches, gamecharacter.BID(*record.BID))
		}
		if record.VID != nil {
			matches = append(matches, gamecharacter.VID(*record.VID))
		}
		if len(matches) > 0 {
			candidates, err := s.db(ctx).GameCharacter.Query().
				Where(gamecharacter.Or(matches...), unlinked(ref.Source, catalog.EntityCharacter)).
				Limit(2).
				IDs(ctx)
			if err != nil {
				return 0, fmt.Errorf("find unlinked character: %w", err)
			}
			if len(candidates) == 1 {
				return s.claimCharacter(ctx, ref, candidates[0], false)
			}
		}
	}
	id, fresh, err := s.createCharacter(ctx, record)
	if err != nil {
		return 0, err
	}
	return s.claimCharacter(ctx, ref, id, fresh)
}

func (s *Store) createCharacter(ctx context.Context, record catalog.CharacterRecord) (int, bool, error) {
	create := s.db(ctx).GameCharacter.Create().
		SetNameJp(record.NameJP).
		SetNillableNameZh(record.NameZH).
		SetNillableNameEn(record.NameEN).
		SetNillableImage(record.Image)
	if record.HikarinagiID != nil {
		id, err := create.SetHID(*record.HikarinagiID).OnConflictColumns(gamecharacter.FieldHID).Ignore().ID(ctx)
		if err != nil {
			return 0, false, fmt.Errorf("upsert character: %w", err)
		}
		return id, false, nil
	}
	row, err := create.Save(ctx)
	if err != nil {
		return 0, false, fmt.Errorf("create character: %w", err)
	}
	return row.ID, true, nil
}

func (s *Store) claimCharacter(ctx context.Context, ref catalog.Ref, id int, fresh bool) (int, error) {
	claimed, err := s.claimLink(ctx, ref, id)
	if err != nil {
		return 0, err
	}
	if claimed != id && fresh {
		if err := s.db(ctx).GameCharacter.DeleteOneID(id).Exec(ctx); err != nil {
			return 0, fmt.Errorf("discard duplicate character: %w", err)
		}
	}
	return claimed, nil
}

func (s *Store) characterExists(ctx context.Context, id int) (bool, error) {
	return s.db(ctx).GameCharacter.Query().Where(gamecharacter.ID(id)).Exist(ctx)
}

func (s *Store) linked(ctx context.Context, ref catalog.Ref, exists func(context.Context, int) (bool, error)) (int, bool, bool, error) {
	link, err := s.link(ctx, ref)
	if err != nil || link == nil {
		return 0, false, false, err
	}
	found, err := exists(ctx, link.LocalID)
	if err != nil {
		return 0, false, false, fmt.Errorf("check linked %s: %w", ref.Entity, err)
	}
	if found {
		return link.LocalID, link.SyncedAt != nil, true, nil
	}
	return 0, false, false, s.dropLink(ctx, link.ID)
}

func setOrClear[T any, B any](value *T, set func(T) B, clear func() B) {
	if value != nil {
		set(*value)
		return
	}
	clear()
}

func nonNilExtra(values []catalog.KeyValue) []catalog.KeyValue {
	if values == nil {
		return []catalog.KeyValue{}
	}
	return values
}
