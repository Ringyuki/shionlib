package authpg

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userloginsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
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

func (r *Repository) CreateSession(ctx context.Context, in auth.NewSession) (auth.Session, error) {
	row, err := r.db(ctx).UserLoginSession.Create().
		SetUserID(in.UserID).
		SetRefreshTokenHash(in.RefreshHash).
		SetRefreshTokenPrefix(in.Prefix).
		SetStatus(int(auth.SessionActive)).
		SetFamilyID(in.FamilyID).
		SetExpiresAt(in.ExpiresAt).
		SetLastUsedAt(in.LastUsedAt).
		SetNillableIP(in.IP).
		SetNillableUserAgent(in.UserAgent).
		Save(ctx)
	if err != nil {
		return auth.Session{}, fmt.Errorf("create login session: %w", err)
	}
	return toSession(row), nil
}

func (r *Repository) LockSessionByPrefix(ctx context.Context, prefix string) (auth.Session, bool, error) {
	return r.sessionByPrefix(ctx, prefix, true)
}

func (r *Repository) FindSessionByPrefix(ctx context.Context, prefix string) (auth.Session, bool, error) {
	return r.sessionByPrefix(ctx, prefix, false)
}

func (r *Repository) sessionByPrefix(ctx context.Context, prefix string, lock bool) (auth.Session, bool, error) {
	query := r.db(ctx).UserLoginSession.Query().Where(userloginsession.RefreshTokenPrefix(prefix))
	if lock {
		query.ForUpdate()
	}
	row, err := query.Only(ctx)
	if postgres.IsNotFound(err) {
		return auth.Session{}, false, nil
	}
	if err != nil {
		return auth.Session{}, false, fmt.Errorf("find login session: %w", err)
	}
	return toSession(row), true, nil
}

func (r *Repository) MarkSessionRotated(ctx context.Context, id, replacedBy int, at time.Time) error {
	err := r.db(ctx).UserLoginSession.UpdateOneID(id).
		SetStatus(int(auth.SessionRotated)).
		SetRotatedAt(at).
		SetReplacedByID(replacedBy).
		SetLastUsedAt(at).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("mark session %d rotated: %w", id, err)
	}
	return nil
}

func (r *Repository) MarkSessionReused(ctx context.Context, id int, at time.Time) error {
	if err := r.db(ctx).UserLoginSession.UpdateOneID(id).SetStatus(int(auth.SessionReused)).SetReusedAt(at).Exec(ctx); err != nil {
		return fmt.Errorf("mark session %d reused: %w", id, err)
	}
	return nil
}

func (r *Repository) BlockFamily(ctx context.Context, familyID string, statuses []auth.SessionStatus, reason string, at time.Time) error {
	values := make([]int, len(statuses))
	for i, status := range statuses {
		values[i] = int(status)
	}
	_, err := r.db(ctx).UserLoginSession.Update().
		Where(userloginsession.FamilyID(familyID), userloginsession.StatusIn(values...)).
		SetStatus(int(auth.SessionBlocked)).
		SetBlockedAt(at).
		SetBlockedReason(reason).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("block session family: %w", err)
	}
	return nil
}

func (r *Repository) BlockUserFamily(ctx context.Context, userID int, familyID, reason string, at time.Time) error {
	_, err := r.db(ctx).UserLoginSession.Update().
		Where(userloginsession.UserID(userID), userloginsession.FamilyID(familyID)).
		SetStatus(int(auth.SessionBlocked)).
		SetBlockedAt(at).
		SetBlockedReason(reason).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("block user session family: %w", err)
	}
	return nil
}

func (r *Repository) BlockUserSessions(ctx context.Context, userID int, reason string, at, liveSince time.Time) ([]auth.LiveFamily, error) {
	db := r.db(ctx)
	var rows []struct {
		FamilyID  string    `json:"family_id"`
		Created   time.Time `json:"created"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	err := db.UserLoginSession.Query().
		Where(
			userloginsession.UserID(userID),
			userloginsession.Status(int(auth.SessionActive)),
			userloginsession.CreatedGT(liveSince),
		).
		GroupBy(userloginsession.FieldFamilyID).
		Aggregate(
			ent.As(ent.Max(userloginsession.FieldCreated), "created"),
			ent.As(ent.Max(userloginsession.FieldExpiresAt), "expires_at"),
		).
		Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("find live session families: %w", err)
	}
	_, err = db.UserLoginSession.Update().
		Where(userloginsession.UserID(userID)).
		SetStatus(int(auth.SessionBlocked)).
		SetBlockedAt(at).
		SetBlockedReason(reason).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("block user sessions: %w", err)
	}
	families := make([]auth.LiveFamily, len(rows))
	for i, row := range rows {
		families[i] = auth.LiveFamily{FamilyID: row.FamilyID, Created: row.Created, ExpiresAt: row.ExpiresAt}
	}
	slices.SortFunc(families, func(a, b auth.LiveFamily) int { return cmp.Compare(a.FamilyID, b.FamilyID) })
	return families, nil
}

func (r *Repository) FamilyStartedAt(ctx context.Context, familyID string) (time.Time, bool, error) {
	row, err := r.db(ctx).UserLoginSession.Query().
		Where(userloginsession.FamilyID(familyID)).
		Order(ent.Asc(userloginsession.FieldCreated), ent.Asc(userloginsession.FieldID)).
		First(ctx)
	if postgres.IsNotFound(err) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, fmt.Errorf("find family start: %w", err)
	}
	return row.Created, true, nil
}

func (r *Repository) DeleteStaleSessions(ctx context.Context, expiredBefore time.Time) (int, error) {
	deleted, err := r.db(ctx).UserLoginSession.Delete().
		Where(
			userloginsession.ExpiresAtLT(expiredBefore),
			userloginsession.StatusIn(int(auth.SessionRotated), int(auth.SessionReused), int(auth.SessionBlocked)),
		).
		Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("delete stale sessions: %w", err)
	}
	return deleted, nil
}

func toSession(row *ent.UserLoginSession) auth.Session {
	return auth.Session{
		ID:          row.ID,
		UserID:      row.UserID,
		RefreshHash: row.RefreshTokenHash,
		Prefix:      row.RefreshTokenPrefix,
		Status:      auth.SessionStatus(row.Status),
		FamilyID:    row.FamilyID,
		ExpiresAt:   row.ExpiresAt,
		Created:     row.Created,
	}
}
