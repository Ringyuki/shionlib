package userpg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/editrecord"
	entfavorite "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/favoriteitem"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userbannedrecord"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	uniqueUserName  = "users_name_key"
	uniqueUserEmail = "users_email_key"
)

type Repository struct {
	client *ent.Client
	tx     *postgres.Transactor
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client, tx: postgres.NewTransactor(client)}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Get(ctx context.Context, id int) (user.User, error) {
	row, err := r.db(ctx).User.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return user.User{}, user.ErrNotFound
	}
	if err != nil {
		return user.User{}, fmt.Errorf("get user %d: %w", id, err)
	}
	return toUser(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (user.User, error) {
	row, err := r.db(ctx).User.Query().Where(entuser.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return user.User{}, user.ErrNotFound
	}
	if err != nil {
		return user.User{}, fmt.Errorf("lock user %d: %w", id, err)
	}
	return toUser(row), nil
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (user.User, bool, error) {
	return r.first(ctx, "find user by email", entuser.Email(email))
}

func (r *Repository) FindByEmailFold(ctx context.Context, email string) (user.User, bool, error) {
	return r.first(ctx, "find user by folded email", entuser.EmailEqualFold(email))
}

func (r *Repository) FindByIdentifier(ctx context.Context, identifier string) (user.User, bool, error) {
	return r.first(ctx, "find user by identifier", entuser.Or(entuser.EmailEqualFold(identifier), entuser.NameEqualFold(identifier)))
}

func (r *Repository) first(ctx context.Context, op string, where ...predicate.User) (user.User, bool, error) {
	row, err := r.db(ctx).User.Query().Where(where...).Order(ent.Asc(entuser.FieldID)).First(ctx)
	if postgres.IsNotFound(err) {
		return user.User{}, false, nil
	}
	if err != nil {
		return user.User{}, false, fmt.Errorf("%s: %w", op, err)
	}
	return toUser(row), true, nil
}

func (r *Repository) NameExists(ctx context.Context, name string) (bool, error) {
	exists, err := r.db(ctx).User.Query().Where(entuser.Name(name)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check user name: %w", err)
	}
	return exists, nil
}

func (r *Repository) Create(ctx context.Context, in user.NewUser) (user.User, error) {
	var created user.User
	err := r.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		db := r.db(ctx)
		row, err := db.User.Create().
			SetName(in.Name).
			SetEmail(in.Email).
			SetNillablePassword(in.PasswordHash).
			SetLang(entuser.Lang(in.Lang)).
			SetContentLimit(int(in.ContentLimit)).
			SetNillableEmailVerifiedAt(in.EmailVerifiedAt).
			Save(ctx)
		if err != nil {
			return translateUnique(err, "create user")
		}
		if err := db.UserUploadQuota.Create().SetUserID(row.ID).SetSize(0).SetUsed(0).Exec(ctx); err != nil {
			return fmt.Errorf("create upload quota: %w", err)
		}
		if err := db.Favorite.Create().SetUserID(row.ID).SetName(user.DefaultFavorite).SetDefault(true).Exec(ctx); err != nil {
			return fmt.Errorf("create default favorite: %w", err)
		}
		created = toUser(row)
		return nil
	})
	return created, err
}

func (r *Repository) Update(ctx context.Context, id int, c user.Changes) error {
	update := r.db(ctx).User.UpdateOneID(id)
	if c.Name != nil {
		update.SetName(*c.Name)
	}
	if c.Email != nil {
		update.SetEmail(*c.Email)
	}
	if c.PasswordHash != nil {
		update.SetPassword(*c.PasswordHash)
	}
	if c.Avatar != nil {
		update.SetAvatar(*c.Avatar)
	}
	if c.Cover != nil {
		update.SetCover(*c.Cover)
	}
	if c.Bio != nil {
		update.SetBio(*c.Bio)
	}
	if c.Lang != nil {
		update.SetLang(entuser.Lang(*c.Lang))
	}
	if c.ContentLimit != nil {
		update.SetContentLimit(int(*c.ContentLimit))
	}
	if c.OnlyGamesWithResources != nil {
		update.SetOnlyGamesWithResources(*c.OnlyGamesWithResources)
	}
	if c.Status != nil {
		update.SetStatus(int(*c.Status))
	}
	if c.EmailVerifiedAt != nil {
		update.SetEmailVerifiedAt(*c.EmailVerifiedAt)
	}
	if c.LastLoginAt != nil {
		update.SetLastLoginAt(*c.LastLoginAt)
	}
	if c.TwoFactorEnabled != nil {
		update.SetTwoFactorEnabled(*c.TwoFactorEnabled)
	}
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return user.ErrNotFound
	}
	if err != nil {
		return translateUnique(err, fmt.Sprintf("update user %d", id))
	}
	return nil
}

func (r *Repository) Stats(ctx context.Context, id int) (user.Stats, error) {
	db := r.db(ctx)
	var stats user.Stats
	counts := []struct {
		target *int
		count  func() (int, error)
	}{
		{&stats.Resources, func() (int, error) {
			return db.GameDownloadResource.Query().Where(gamedownloadresource.CreatorID(id)).Count(ctx)
		}},
		{&stats.Comments, func() (int, error) { return db.Comment.Query().Where(comment.CreatorID(id)).Count(ctx) }},
		{&stats.FavoriteItems, func() (int, error) {
			return db.FavoriteItem.Query().Where(favoriteitem.HasFavoriteWith(entfavorite.UserID(id))).Count(ctx)
		}},
		{&stats.Edits, func() (int, error) { return db.EditRecord.Query().Where(editrecord.ActorID(id)).Count(ctx) }},
		{&stats.Walkthroughs, func() (int, error) { return db.Walkthrough.Query().Where(walkthrough.CreatorID(id)).Count(ctx) }},
	}
	for _, c := range counts {
		value, err := c.count()
		if err != nil {
			return user.Stats{}, fmt.Errorf("count user %d activity: %w", id, err)
		}
		*c.target = value
	}
	return stats, nil
}

func (r *Repository) CreateBan(ctx context.Context, in user.NewBan) error {
	err := r.db(ctx).UserBannedRecord.Create().
		SetUserID(in.UserID).
		SetNillableBannedBy(in.BannedBy).
		SetNillableBannedReason(in.Reason).
		SetNillableBannedDurationDays(in.DurationDays).
		SetIsPermanent(in.Permanent).
		Exec(ctx)
	if postgres.IsForeignKeyViolation(err, "user_banned_records_user_id_fkey") {
		return user.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("create ban record: %w", err)
	}
	return nil
}

func (r *Repository) CloseLatestBan(ctx context.Context, userID int, at time.Time) error {
	db := r.db(ctx)
	latest, err := db.UserBannedRecord.Query().
		Where(userbannedrecord.UserID(userID), userbannedrecord.UnbannedAtIsNil()).
		Order(ent.Desc(userbannedrecord.FieldBannedAt), ent.Desc(userbannedrecord.FieldID)).
		First(ctx)
	if postgres.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("find latest ban: %w", err)
	}
	if err := db.UserBannedRecord.UpdateOneID(latest.ID).SetUnbannedAt(at).Exec(ctx); err != nil {
		return fmt.Errorf("close ban %d: %w", latest.ID, err)
	}
	return nil
}

func (r *Repository) ActiveBans(ctx context.Context) ([]user.Ban, error) {
	rows, err := r.db(ctx).UserBannedRecord.Query().
		Where(
			userbannedrecord.UnbannedAtIsNil(),
			userbannedrecord.HasUserWith(entuser.Status(int(user.StatusBanned))),
		).
		Order(ent.Asc(userbannedrecord.FieldUserID), ent.Desc(userbannedrecord.FieldBannedAt), ent.Desc(userbannedrecord.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list active bans: %w", err)
	}
	bans := []user.Ban{}
	for _, row := range rows {
		if len(bans) > 0 && bans[len(bans)-1].UserID == row.UserID {
			continue
		}
		bans = append(bans, user.Ban{UserID: row.UserID, BannedAt: row.BannedAt, DurationDays: row.BannedDurationDays, Permanent: row.IsPermanent})
	}
	return bans, nil
}

func (r *Repository) DeleteComments(ctx context.Context, userID int) error {
	if _, err := r.db(ctx).Comment.Delete().Where(comment.CreatorID(userID)).Exec(ctx); err != nil {
		return fmt.Errorf("delete comments of user %d: %w", userID, err)
	}
	return nil
}

func translateUnique(err error, op string) error {
	switch {
	case postgres.IsUniqueViolation(err, uniqueUserName):
		return user.ErrNameAlreadyExists
	case postgres.IsUniqueViolation(err, uniqueUserEmail):
		return user.ErrEmailAlreadyExists
	default:
		return fmt.Errorf("%s: %w", op, err)
	}
}
