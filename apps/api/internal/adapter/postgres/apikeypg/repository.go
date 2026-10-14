package apikeypg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userapikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
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

func (r *Repository) Create(ctx context.Context, in apikey.NewKey) (apikey.Key, error) {
	row, err := r.db(ctx).UserAPIKey.Create().
		SetUserID(in.UserID).
		SetName(in.Name).
		SetPrefix(in.Prefix).
		SetSecretHash(in.SecretHash).
		SetStatus(int(apikey.StatusActive)).
		Save(ctx)
	if err != nil {
		return apikey.Key{}, fmt.Errorf("create API key of user %d: %w", in.UserID, err)
	}
	return toKey(row), nil
}

func (r *Repository) Mine(ctx context.Context, userID int) ([]apikey.Key, error) {
	rows, err := r.db(ctx).UserAPIKey.Query().
		Where(userapikey.UserID(userID)).
		Order(ent.Desc(userapikey.FieldCreated), ent.Desc(userapikey.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list API keys of user %d: %w", userID, err)
	}
	return toKeys(rows), nil
}

func (r *Repository) CountMine(ctx context.Context, userID int) (int, error) {
	count, err := r.db(ctx).UserAPIKey.Query().Where(userapikey.UserID(userID)).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count API keys of user %d: %w", userID, err)
	}
	return count, nil
}

func (r *Repository) DeleteMine(ctx context.Context, userID, id int) error {
	deleted, err := r.db(ctx).UserAPIKey.Delete().Where(userapikey.ID(id), userapikey.UserID(userID)).Exec(ctx)
	if err != nil {
		return fmt.Errorf("delete API key %d: %w", id, err)
	}
	if deleted == 0 {
		return apikey.ErrNotFound
	}
	return nil
}

func (r *Repository) BySecretHash(ctx context.Context, hash string) (apikey.Key, error) {
	row, err := r.db(ctx).UserAPIKey.Query().Where(userapikey.SecretHash(hash)).Only(ctx)
	if postgres.IsNotFound(err) {
		return apikey.Key{}, apikey.ErrNotFound
	}
	if err != nil {
		return apikey.Key{}, fmt.Errorf("find API key: %w", err)
	}
	return toKey(row), nil
}

func (r *Repository) Owner(ctx context.Context, userID int) (apikey.Owner, error) {
	row, err := r.db(ctx).User.Query().
		Where(entuser.ID(userID)).
		Select(entuser.FieldStatus, entuser.FieldAPIRequestLimit).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return apikey.Owner{}, apikey.ErrKeyInvalid
	}
	if err != nil {
		return apikey.Owner{}, fmt.Errorf("read the owner of an API key, user %d: %w", userID, err)
	}
	return apikey.Owner{Banned: user.Status(row.Status) == user.StatusBanned, Limit: row.APIRequestLimit}, nil
}

func (r *Repository) Touch(ctx context.Context, id int, at time.Time, ip string) error {
	if err := r.db(ctx).UserAPIKey.UpdateOneID(id).SetLastUsedAt(at.UTC()).SetLastUsedIP(ip).Exec(ctx); err != nil && !postgres.IsNotFound(err) {
		return fmt.Errorf("record the use of API key %d: %w", id, err)
	}
	return nil
}

func (r *Repository) Get(ctx context.Context, id int) (apikey.Key, error) {
	row, err := r.db(ctx).UserAPIKey.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return apikey.Key{}, apikey.ErrNotFound
	}
	if err != nil {
		return apikey.Key{}, fmt.Errorf("get API key %d: %w", id, err)
	}
	return toKey(row), nil
}

func (r *Repository) SetSuspended(ctx context.Context, id int, reason *string, at *time.Time, by *int) error {
	update := r.db(ctx).UserAPIKey.UpdateOneID(id)
	if at == nil {
		update.SetStatus(int(apikey.StatusActive)).ClearSuspendedReason().ClearSuspendedAt().ClearSuspendedBy()
	} else {
		update.SetStatus(int(apikey.StatusSuspended)).SetNillableSuspendedReason(reason).SetSuspendedAt(at.UTC()).SetNillableSuspendedBy(by)
	}
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return apikey.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("change the status of API key %d: %w", id, err)
	}
	return nil
}

func (r *Repository) SetAccountLimit(ctx context.Context, userID int, limit *int) error {
	update := r.db(ctx).User.UpdateOneID(userID)
	if limit == nil {
		update.ClearAPIRequestLimit()
	} else {
		update.SetAPIRequestLimit(*limit)
	}
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return user.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("set the API request limit of user %d: %w", userID, err)
	}
	return nil
}
