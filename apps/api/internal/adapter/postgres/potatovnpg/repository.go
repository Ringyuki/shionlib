package potatovnpg

import (
	"context"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gametagrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/usergamepvnmapping"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userpvnbinding"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

const (
	uniqueBindingUser   = "user_pvn_bindings_user_id_key"
	uniqueMappingGame   = "user_game_pvn_mappings_user_id_game_id_key"
	uniqueMappingRemote = "user_game_pvn_mappings_user_id_pvn_galgame_id_key"
	mappingGameFK       = "user_game_pvn_mappings_game_id_fkey"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Binding(ctx context.Context, userID int) (potatovn.Binding, error) {
	row, err := r.db(ctx).UserPvnBinding.Query().Where(userpvnbinding.UserID(userID)).Only(ctx)
	if postgres.IsNotFound(err) {
		return potatovn.Binding{}, potatovn.ErrBindingNotFound
	}
	if err != nil {
		return potatovn.Binding{}, fmt.Errorf("get potatovn binding of user %d: %w", userID, err)
	}
	return toBinding(row), nil
}

func (r *Repository) CreateBinding(ctx context.Context, in potatovn.NewBinding) (potatovn.Binding, error) {
	row, err := r.db(ctx).UserPvnBinding.Create().
		SetUserID(in.UserID).
		SetPvnUserID(in.PVNUserID).
		SetPvnUserName(in.PVNUserName).
		SetPvnToken(in.Token).
		SetPvnTokenExpires(in.TokenExpires).
		Save(ctx)
	if postgres.IsUniqueViolation(err, uniqueBindingUser) {
		return potatovn.Binding{}, potatovn.ErrBindingAlreadyExists
	}
	if err != nil {
		return potatovn.Binding{}, fmt.Errorf("create potatovn binding: %w", err)
	}
	return toBinding(row), nil
}

func (r *Repository) DeleteBinding(ctx context.Context, userID int) error {
	count, err := r.db(ctx).UserPvnBinding.Delete().Where(userpvnbinding.UserID(userID)).Exec(ctx)
	if err != nil {
		return fmt.Errorf("delete potatovn binding of user %d: %w", userID, err)
	}
	if count == 0 {
		return potatovn.ErrBindingNotFound
	}
	return nil
}

func (r *Repository) UpdateToken(ctx context.Context, userID int, token string, expires time.Time) error {
	count, err := r.db(ctx).UserPvnBinding.Update().
		Where(userpvnbinding.UserID(userID)).
		SetPvnToken(token).
		SetPvnTokenExpires(expires).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("update potatovn token of user %d: %w", userID, err)
	}
	if count == 0 {
		return potatovn.ErrBindingNotFound
	}
	return nil
}

func (r *Repository) BindingsExpiringBefore(ctx context.Context, at time.Time) ([]int, error) {
	ids, err := r.db(ctx).UserPvnBinding.Query().
		Where(userpvnbinding.PvnTokenExpiresLTE(at)).
		Order(ent.Asc(userpvnbinding.FieldUserID)).
		Select(userpvnbinding.FieldUserID).
		Ints(ctx)
	if err != nil {
		return nil, fmt.Errorf("list expiring potatovn bindings: %w", err)
	}
	return ids, nil
}

func (r *Repository) BindingUserIDs(ctx context.Context, afterUserID, limit int) ([]int, error) {
	ids, err := r.db(ctx).UserPvnBinding.Query().
		Where(predicate.UserPvnBinding(entsql.FieldGT(userpvnbinding.FieldUserID, afterUserID))).
		Order(ent.Asc(userpvnbinding.FieldUserID)).
		Limit(limit).
		Select(userpvnbinding.FieldUserID).
		Ints(ctx)
	if err != nil {
		return nil, fmt.Errorf("list potatovn bindings: %w", err)
	}
	return ids, nil
}

func (r *Repository) DeleteExpiredBindings(ctx context.Context, now time.Time) (int, error) {
	expired := userpvnbinding.PvnTokenExpiresLT(now)
	if _, err := r.db(ctx).UserGamePvnMapping.Delete().
		Where(usergamepvnmapping.HasUserWith(entuser.HasPotatovnBindingWith(expired))).
		Exec(ctx); err != nil {
		return 0, fmt.Errorf("delete mappings of expired potatovn bindings: %w", err)
	}
	count, err := r.db(ctx).UserPvnBinding.Delete().Where(expired).Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("delete expired potatovn bindings: %w", err)
	}
	return count, nil
}

func (r *Repository) Mapping(ctx context.Context, userID, gameID int) (potatovn.Mapping, error) {
	row, err := r.db(ctx).UserGamePvnMapping.Query().
		Where(usergamepvnmapping.UserID(userID), usergamepvnmapping.GameID(gameID)).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return potatovn.Mapping{}, potatovn.ErrMappingNotFound
	}
	if err != nil {
		return potatovn.Mapping{}, fmt.Errorf("get potatovn mapping: %w", err)
	}
	return toMapping(row), nil
}

func (r *Repository) CreateMapping(ctx context.Context, in potatovn.NewMapping) (potatovn.Mapping, error) {
	row, err := r.db(ctx).UserGamePvnMapping.Create().
		SetUserID(in.UserID).
		SetGameID(in.GameID).
		SetPvnGalgameID(in.PVNGalgameID).
		SetTotalPlayTime(in.TotalPlayTime).
		SetNillableLastPlayDate(in.LastPlayDate).
		SetPlayType(in.PlayType).
		SetMyRate(in.MyRate).
		SetSyncedAt(in.SyncedAt).
		Save(ctx)
	if err := translateMappingError(err); err != nil {
		return potatovn.Mapping{}, err
	}
	return toMapping(row), nil
}

func (r *Repository) SyncMapping(ctx context.Context, in potatovn.NewMapping) error {
	err := r.db(ctx).UserGamePvnMapping.Create().
		SetUserID(in.UserID).
		SetGameID(in.GameID).
		SetPvnGalgameID(in.PVNGalgameID).
		SetTotalPlayTime(in.TotalPlayTime).
		SetNillableLastPlayDate(in.LastPlayDate).
		SetPlayType(in.PlayType).
		SetMyRate(in.MyRate).
		SetSyncedAt(in.SyncedAt).
		OnConflictColumns(usergamepvnmapping.FieldUserID, usergamepvnmapping.FieldPvnGalgameID).
		Update(func(u *ent.UserGamePvnMappingUpsert) {
			u.UpdateTotalPlayTime()
			u.UpdateLastPlayDate()
			u.UpdatePlayType()
			u.UpdateMyRate()
			u.UpdateSyncedAt()
			u.UpdateUpdated()
		}).
		Exec(ctx)
	return translateMappingError(err)
}

func (r *Repository) DeleteMapping(ctx context.Context, userID, gameID int) error {
	count, err := r.db(ctx).UserGamePvnMapping.Delete().
		Where(usergamepvnmapping.UserID(userID), usergamepvnmapping.GameID(gameID)).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("delete potatovn mapping: %w", err)
	}
	if count == 0 {
		return potatovn.ErrMappingNotFound
	}
	return nil
}

func (r *Repository) DeleteMappings(ctx context.Context, userID int) error {
	if _, err := r.db(ctx).UserGamePvnMapping.Delete().Where(usergamepvnmapping.UserID(userID)).Exec(ctx); err != nil {
		return fmt.Errorf("delete potatovn mappings of user %d: %w", userID, err)
	}
	return nil
}

func (r *Repository) GameInfo(ctx context.Context, gameID int) (potatovn.GameInfo, error) {
	row, err := r.db(ctx).Game.Query().
		Where(entgame.ID(gameID)).
		WithTagRelations(func(q *ent.GameTagRelationQuery) {
			q.WithTag().Order(ent.Asc(gametagrelation.FieldTagID))
		}).
		WithCovers(func(q *ent.GameCoverQuery) {
			q.Where(gamecover.Sexual(0), gamecover.Violence(0)).Order(ent.Asc(gamecover.FieldID))
		}).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return potatovn.GameInfo{}, game.ErrNotFound
	}
	if err != nil {
		return potatovn.GameInfo{}, fmt.Errorf("get game %d for potatovn: %w", gameID, err)
	}
	info := potatovn.GameInfo{
		ID:          row.ID,
		VNDBID:      row.VID,
		BangumiID:   row.BID,
		TitleJP:     row.TitleJp,
		TitleZH:     row.TitleZh,
		TitleEN:     row.TitleEn,
		IntroJP:     row.IntroJp,
		IntroZH:     row.IntroZh,
		IntroEN:     row.IntroEn,
		ReleaseDate: row.ReleaseDate,
		Tags:        make([]string, 0, len(row.Edges.TagRelations)),
	}
	for _, relation := range row.Edges.TagRelations {
		switch {
		case relation.TagAlias != nil:
			info.Tags = append(info.Tags, *relation.TagAlias)
		case relation.Edges.Tag != nil:
			info.Tags = append(info.Tags, relation.Edges.Tag.Name)
		}
	}
	if len(row.Edges.Covers) > 0 {
		key := row.Edges.Covers[0].URL
		info.CoverKey = &key
	}
	return info, nil
}

func (r *Repository) MatchGame(ctx context.Context, bangumiID, vndbID *string) (int, bool, error) {
	var conditions []predicate.Game
	if bangumiID != nil {
		conditions = append(conditions, entgame.BID(*bangumiID))
	}
	if vndbID != nil {
		conditions = append(conditions, entgame.VID(*vndbID))
	}
	if len(conditions) == 0 {
		return 0, false, nil
	}
	ids, err := r.db(ctx).Game.Query().
		Where(entgame.Or(conditions...)).
		Order(ent.Asc(entgame.FieldID)).
		Limit(1).
		IDs(ctx)
	if err != nil {
		return 0, false, fmt.Errorf("match game for potatovn: %w", err)
	}
	if len(ids) == 0 {
		return 0, false, nil
	}
	return ids[0], true, nil
}

func translateMappingError(err error) error {
	switch {
	case err == nil:
		return nil
	case postgres.IsUniqueViolation(err, uniqueMappingGame), postgres.IsUniqueViolation(err, uniqueMappingRemote):
		return potatovn.ErrMappingConflict
	case postgres.IsForeignKeyViolation(err, mappingGameFK):
		return game.ErrNotFound
	default:
		return fmt.Errorf("save potatovn mapping: %w", err)
	}
}

func toBinding(row *ent.UserPvnBinding) potatovn.Binding {
	return potatovn.Binding{
		UserID:        row.UserID,
		PVNUserID:     row.PvnUserID,
		PVNUserName:   row.PvnUserName,
		PVNUserAvatar: row.PvnUserAvatar,
		Token:         row.PvnToken,
		TokenExpires:  row.PvnTokenExpires,
		Created:       row.Created,
		Updated:       row.Updated,
	}
}

func toMapping(row *ent.UserGamePvnMapping) potatovn.Mapping {
	return potatovn.Mapping{
		UserID:       row.UserID,
		GameID:       row.GameID,
		PVNGalgameID: row.PvnGalgameID,
		PlayData: potatovn.PlayData{
			TotalPlayTime: row.TotalPlayTime,
			LastPlayDate:  row.LastPlayDate,
			PlayType:      row.PlayType,
			MyRate:        row.MyRate,
		},
		SyncedAt: row.SyncedAt,
	}
}
