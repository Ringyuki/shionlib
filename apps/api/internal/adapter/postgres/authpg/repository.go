package authpg

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/oidcidentity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userloginsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userpasskeycredential"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

const (
	constraintAuthenticatorID    = "user_passkey_credentials_credential_id_key"
	uniqueIdentitySubject        = "oidc_identities_provider_subject_key"
	constraintAuthenticatorOwner = "user_passkey_credentials_user_id_fkey"
	identityUserForeignKey       = "oidc_identities_user_id_fkey"
	errMissingParentMessage      = "%s references a missing user: %w"
)

func (r *Repository) ActivePasskeys(ctx context.Context, userID int) ([]auth.Passkey, error) {
	rows, err := r.db(ctx).UserPasskeyCredential.Query().
		Where(userpasskeycredential.UserID(userID), userpasskeycredential.RevokedAtIsNil()).
		Order(ent.Asc(userpasskeycredential.FieldCreated), ent.Asc(userpasskeycredential.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list passkeys: %w", err)
	}
	keys := make([]auth.Passkey, len(rows))
	for i, row := range rows {
		keys[i] = toPasskey(row)
	}
	return keys, nil
}

func (r *Repository) FindActivePasskey(ctx context.Context, credentialID string) (auth.Passkey, bool, error) {
	row, err := r.db(ctx).UserPasskeyCredential.Query().
		Where(userpasskeycredential.CredentialID(credentialID), userpasskeycredential.RevokedAtIsNil()).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return auth.Passkey{}, false, nil
	}
	if err != nil {
		return auth.Passkey{}, false, fmt.Errorf("find passkey: %w", err)
	}
	return toPasskey(row), true, nil
}

func (r *Repository) CreatePasskey(ctx context.Context, in auth.NewPasskey) (auth.Passkey, error) {
	transports := pgvalue.Strings(in.Transports)
	if transports == nil {
		transports = pgvalue.Strings{}
	}
	row, err := r.db(ctx).UserPasskeyCredential.Create().
		SetUserID(in.UserID).
		SetCredentialID(in.CredentialID).
		SetPublicKey(in.PublicKey).
		SetCounter(in.Counter).
		SetTransports(transports).
		SetNillableAaguid(in.AAGUID).
		SetDeviceType(in.DeviceType).
		SetCredentialBackedUp(in.BackedUp).
		SetNillableName(in.Name).
		SetLastUsedAt(in.LastUsedAt).
		Save(ctx)
	switch {
	case postgres.IsUniqueViolation(err, constraintAuthenticatorID):
		return auth.Passkey{}, auth.ErrPasskeyExists
	case postgres.IsForeignKeyViolation(err, constraintAuthenticatorOwner):
		return auth.Passkey{}, fmt.Errorf(errMissingParentMessage, "passkey", err)
	case err != nil:
		return auth.Passkey{}, fmt.Errorf("create passkey: %w", err)
	}
	return toPasskey(row), nil
}

func (r *Repository) RecordPasskeyUse(ctx context.Context, id int, use auth.PasskeyUse) error {
	err := r.db(ctx).UserPasskeyCredential.UpdateOneID(id).
		SetCounter(use.Counter).
		SetDeviceType(use.DeviceType).
		SetCredentialBackedUp(use.BackedUp).
		SetLastUsedAt(use.At).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("record passkey %d use: %w", id, err)
	}
	return nil
}

func (r *Repository) RevokePasskey(ctx context.Context, id, userID int, at time.Time) (bool, error) {
	updated, err := r.db(ctx).UserPasskeyCredential.Update().
		Where(userpasskeycredential.ID(id), userpasskeycredential.UserID(userID), userpasskeycredential.RevokedAtIsNil()).
		SetRevokedAt(at).
		Save(ctx)
	if err != nil {
		return false, fmt.Errorf("revoke passkey %d: %w", id, err)
	}
	return updated > 0, nil
}

func (r *Repository) CountActivePasskeys(ctx context.Context, userID int) (int, error) {
	count, err := r.db(ctx).UserPasskeyCredential.Query().
		Where(userpasskeycredential.UserID(userID), userpasskeycredential.RevokedAtIsNil()).
		Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count passkeys: %w", err)
	}
	return count, nil
}

func (r *Repository) FindIdentity(ctx context.Context, provider, subject string) (auth.Identity, bool, error) {
	row, err := r.db(ctx).OidcIdentity.Query().Where(oidcidentity.Provider(provider), oidcidentity.Subject(subject)).Only(ctx)
	if postgres.IsNotFound(err) {
		return auth.Identity{}, false, nil
	}
	if err != nil {
		return auth.Identity{}, false, fmt.Errorf("find oidc identity: %w", err)
	}
	return toIdentity(row), true, nil
}

func (r *Repository) GetIdentity(ctx context.Context, id int) (auth.Identity, bool, error) {
	row, err := r.db(ctx).OidcIdentity.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return auth.Identity{}, false, nil
	}
	if err != nil {
		return auth.Identity{}, false, fmt.Errorf("get oidc identity %d: %w", id, err)
	}
	return toIdentity(row), true, nil
}

func (r *Repository) CreateIdentity(ctx context.Context, in auth.NewIdentity) error {
	err := r.db(ctx).OidcIdentity.Create().
		SetUserID(in.UserID).
		SetProvider(in.Provider).
		SetSubject(in.Subject).
		SetNillableEmailAtLink(in.EmailAtLink).
		SetLastLoginAt(in.LastLoginAt).
		Exec(ctx)
	switch {
	case postgres.IsUniqueViolation(err, uniqueIdentitySubject):
		return auth.ErrIdentityExists
	case postgres.IsForeignKeyViolation(err, identityUserForeignKey):
		return fmt.Errorf(errMissingParentMessage, "oidc identity", err)
	case err != nil:
		return fmt.Errorf("create oidc identity: %w", err)
	}
	return nil
}

func (r *Repository) TouchIdentity(ctx context.Context, id int, at time.Time) error {
	if err := r.db(ctx).OidcIdentity.UpdateOneID(id).SetLastLoginAt(at).Exec(ctx); err != nil {
		return fmt.Errorf("touch oidc identity %d: %w", id, err)
	}
	return nil
}

func (r *Repository) ListIdentities(ctx context.Context, userID int) ([]auth.Identity, error) {
	rows, err := r.db(ctx).OidcIdentity.Query().
		Where(oidcidentity.UserID(userID)).
		Order(ent.Asc(oidcidentity.FieldCreated), ent.Asc(oidcidentity.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list oidc identities: %w", err)
	}
	items := make([]auth.Identity, len(rows))
	for i, row := range rows {
		items[i] = toIdentity(row)
	}
	return items, nil
}

func (r *Repository) CountIdentities(ctx context.Context, userID int) (int, error) {
	count, err := r.db(ctx).OidcIdentity.Query().Where(oidcidentity.UserID(userID)).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count oidc identities: %w", err)
	}
	return count, nil
}

func (r *Repository) DeleteIdentity(ctx context.Context, id int) error {
	err := r.db(ctx).OidcIdentity.DeleteOneID(id).Exec(ctx)
	if err != nil && !postgres.IsNotFound(err) {
		return fmt.Errorf("delete oidc identity %d: %w", id, err)
	}
	return nil
}

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
