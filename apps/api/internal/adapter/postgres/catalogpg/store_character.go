package catalogpg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

func (s *Store) ensureCharacter(ctx context.Context, source string, credit catalog.CharacterLink) (int, bool, error) {
	ref := catalog.Ref{Source: source, Entity: catalog.EntityCharacter, ExternalID: credit.ExternalID}
	if err := s.lockRef(ctx, ref); err != nil {
		return 0, false, err
	}
	id, synced, ok, err := s.linked(ctx, ref, s.characterExists)
	if err != nil || ok {
		return id, !synced, err
	}
	seed := catalog.CharacterRecord{HikarinagiID: credit.HikarinagiID, NameJP: credit.NameJP, NameZH: credit.NameZH, NameEN: credit.NameEN, Image: credit.Image, ImageThumbHash: credit.ImageThumbHash}
	id, err = s.createCharacter(ctx, seed)
	if err != nil {
		return 0, false, err
	}
	id, err = s.insertLink(ctx, ref, id)
	return id, true, err
}

func (s *Store) ApplyCharacter(ctx context.Context, source string, record catalog.CharacterRecord, at time.Time) (int, error) {
	ref := catalog.Ref{Source: source, Entity: catalog.EntityCharacter, ExternalID: record.ExternalID}
	if err := s.lockRef(ctx, ref); err != nil {
		return 0, err
	}
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
	setOrClear(record.ImageThumbHash, update.SetImageThumbHash, update.ClearImageThumbHash)
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
				return s.insertLink(ctx, ref, candidates[0])
			}
		}
	}
	id, err := s.createCharacter(ctx, record)
	if err != nil {
		return 0, err
	}
	return s.insertLink(ctx, ref, id)
}

func (s *Store) createCharacter(ctx context.Context, record catalog.CharacterRecord) (int, error) {
	create := s.db(ctx).GameCharacter.Create().
		SetNameJp(record.NameJP).
		SetNillableNameZh(record.NameZH).
		SetNillableNameEn(record.NameEN).
		SetNillableImage(record.Image).
		SetNillableImageThumbHash(record.ImageThumbHash)
	if record.HikarinagiID != nil {
		id, err := create.SetHID(*record.HikarinagiID).OnConflictColumns(gamecharacter.FieldHID).Ignore().ID(ctx)
		if err != nil {
			return 0, fmt.Errorf("upsert character: %w", err)
		}
		return id, nil
	}
	row, err := create.Save(ctx)
	if err != nil {
		return 0, fmt.Errorf("create character: %w", err)
	}
	return row.ID, nil
}

func (s *Store) characterExists(ctx context.Context, id int) (bool, error) {
	return s.db(ctx).GameCharacter.Query().Where(gamecharacter.ID(id)).Exist(ctx)
}
