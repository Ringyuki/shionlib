package adminpg

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userbannedrecord"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userloginsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/useruploadquota"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var userSortFields = map[admin.UserSortField]string{
	admin.UserSortByID:          entuser.FieldID,
	admin.UserSortByName:        entuser.FieldName,
	admin.UserSortByEmail:       entuser.FieldEmail,
	admin.UserSortByRole:        entuser.FieldRole,
	admin.UserSortByStatus:      entuser.FieldStatus,
	admin.UserSortByCreated:     entuser.FieldCreated,
	admin.UserSortByUpdated:     entuser.FieldUpdated,
	admin.UserSortByLastLoginAt: entuser.FieldLastLoginAt,
}

var entryFields = []string{
	entuser.FieldID, entuser.FieldName, entuser.FieldEmail, entuser.FieldAvatar, entuser.FieldRole, entuser.FieldStatus,
	entuser.FieldLang, entuser.FieldContentLimit, entuser.FieldCreated, entuser.FieldUpdated, entuser.FieldLastLoginAt,
	entuser.FieldTwoFactorEnabled, entuser.FieldSponsorExpiresAt,
}

type UserStore struct {
	client *ent.Client
}

func NewUserStore(client *ent.Client) *UserStore {
	return &UserStore{client: client}
}

func (s *UserStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *UserStore) SearchUsers(ctx context.Context, filter admin.UserFilter, page admin.Page) ([]admin.UserEntry, int, error) {
	query := s.db(ctx).User.Query()
	if filter.Role != nil {
		query.Where(entuser.Role(int(*filter.Role)))
	}
	if filter.Status != nil {
		query.Where(entuser.Status(int(*filter.Status)))
	}
	if filter.Search != "" {
		query.Where(entuser.Or(searchPredicates(filter.Search)...))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}
	field, ok := userSortFields[filter.SortBy]
	if !ok {
		field = entuser.FieldID
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	rows, err := query.Select(entryFields...).Order(order(field), order(entuser.FieldID)).Offset(page.Offset()).Limit(page.Size).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("search users: %w", err)
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	counts, err := s.counts(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	entries := make([]admin.UserEntry, len(rows))
	for i, row := range rows {
		entries[i] = toEntry(row, counts[row.ID])
	}
	return entries, total, nil
}

func searchPredicates(search string) []predicate.User {
	predicates := []predicate.User{entuser.NameContainsFold(search), entuser.EmailContainsFold(search)}
	if id, err := strconv.ParseInt(search, 10, 64); err == nil && id >= math.MinInt32 && id <= math.MaxInt32 {
		predicates = append(predicates, entuser.ID(int(id)))
	}
	return predicates
}

func (s *UserStore) UserDetail(ctx context.Context, id int) (admin.UserDetail, error) {
	db := s.db(ctx)
	row, err := db.User.Query().Where(entuser.ID(id)).Select(append([]string{entuser.FieldCover}, entryFields...)...).Only(ctx)
	if postgres.IsNotFound(err) {
		return admin.UserDetail{}, user.ErrNotFound
	}
	if err != nil {
		return admin.UserDetail{}, fmt.Errorf("get user %d: %w", id, err)
	}
	counts, err := s.counts(ctx, []int{id})
	if err != nil {
		return admin.UserDetail{}, err
	}
	detail := admin.UserDetail{UserEntry: toEntry(row, counts[id]), Cover: row.Cover}
	quota, err := db.UserUploadQuota.Query().Where(useruploadquota.UserID(id)).Only(ctx)
	switch {
	case err == nil:
		detail.Quota = &admin.Quota{Size: quota.Size, Used: quota.Used, IsFirstGrant: quota.IsFirstGrant}
	case !postgres.IsNotFound(err):
		return admin.UserDetail{}, fmt.Errorf("load upload quota of user %d: %w", id, err)
	}
	ban, err := db.UserBannedRecord.Query().
		Where(userbannedrecord.UserID(id)).
		WithBannedByUser(func(q *ent.UserQuery) { q.Select(entuser.FieldID, entuser.FieldName) }).
		Order(ent.Desc(userbannedrecord.FieldBannedAt), ent.Desc(userbannedrecord.FieldID)).
		First(ctx)
	switch {
	case err == nil:
		detail.LatestBan = toBan(ban)
	case !postgres.IsNotFound(err):
		return admin.UserDetail{}, fmt.Errorf("load latest ban of user %d: %w", id, err)
	}
	return detail, nil
}

const countsQuery = `
SELECT 'comments', creator_id, COUNT(*) FROM comments WHERE creator_id = ANY($1::int[]) GROUP BY creator_id
UNION ALL
SELECT 'resources', creator_id, COUNT(*) FROM game_download_resources WHERE creator_id = ANY($1::int[]) GROUP BY creator_id
UNION ALL
SELECT 'favorites', user_id, COUNT(*) FROM favorites WHERE user_id = ANY($1::int[]) GROUP BY user_id
UNION ALL
SELECT 'edits', actor_id, COUNT(*) FROM edit_records WHERE actor_id = ANY($1::int[]) GROUP BY actor_id`

func (s *UserStore) counts(ctx context.Context, ids []int) (map[int]admin.Counts, error) {
	counts := make(map[int]admin.Counts, len(ids))
	if len(ids) == 0 {
		return counts, nil
	}
	rows, err := s.db(ctx).QueryContext(ctx, countsQuery, pgvalue.Ints(ids))
	if err != nil {
		return nil, fmt.Errorf("count user contributions: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	for rows.Next() {
		var (
			kind  string
			owner int
			n     int
		)
		if err := rows.Scan(&kind, &owner, &n); err != nil {
			return nil, fmt.Errorf("scan user contributions: %w", err)
		}
		c := counts[owner]
		switch kind {
		case "comments":
			c.Comments = n
		case "resources":
			c.Resources = n
		case "favorites":
			c.Favorites = n
		case "edits":
			c.Edits = n
		}
		counts[owner] = c
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read user contributions: %w", err)
	}
	return counts, nil
}

func (s *UserStore) SetRole(ctx context.Context, id int, role actor.Role) error {
	return s.update(ctx, id, s.db(ctx).User.UpdateOneID(id).SetRole(int(role)))
}

func (s *UserStore) SetSponsorExpiry(ctx context.Context, id int, expiresAt *time.Time) error {
	update := s.db(ctx).User.UpdateOneID(id)
	if expiresAt == nil {
		update.ClearSponsorExpiresAt()
	} else {
		update.SetSponsorExpiresAt(expiresAt.UTC())
	}
	return s.update(ctx, id, update)
}

func (s *UserStore) update(ctx context.Context, id int, update *ent.UserUpdateOne) error {
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return user.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("update user %d: %w", id, err)
	}
	return nil
}

func (s *UserStore) Sessions(ctx context.Context, filter admin.SessionFilter, page admin.Page) ([]admin.Session, int, error) {
	query := s.db(ctx).UserLoginSession.Query().Where(userloginsession.UserID(filter.UserID))
	if filter.Status != nil {
		query.Where(userloginsession.Status(int(*filter.Status)))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count sessions: %w", err)
	}
	rows, err := query.
		Order(ent.Desc(userloginsession.FieldCreated), ent.Desc(userloginsession.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list sessions: %w", err)
	}
	sessions := make([]admin.Session, len(rows))
	for i, row := range rows {
		sessions[i] = admin.Session{
			ID:            row.ID,
			FamilyID:      row.FamilyID,
			Status:        auth.SessionStatus(row.Status),
			IP:            row.IP,
			UserAgent:     row.UserAgent,
			DeviceInfo:    row.DeviceInfo,
			Created:       row.Created,
			Updated:       row.Updated,
			LastUsedAt:    row.LastUsedAt,
			ExpiresAt:     row.ExpiresAt,
			RotatedAt:     row.RotatedAt,
			ReusedAt:      row.ReusedAt,
			BlockedAt:     row.BlockedAt,
			BlockedReason: row.BlockedReason,
		}
	}
	return sessions, total, nil
}
