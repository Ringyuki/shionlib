package uploadpg

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userloginsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/useruploadquota"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/useruploadquotarecord"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	userActive = 1
	roleUser   = 1
	checkOK    = 1
)

type QuotaRepository struct {
	client *ent.Client
}

func NewQuotaRepository(client *ent.Client) *QuotaRepository {
	return &QuotaRepository{client: client}
}

func (r *QuotaRepository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *QuotaRepository) FindQuota(ctx context.Context, userID int) (upload.Quota, bool, error) {
	row, err := r.db(ctx).UserUploadQuota.Query().Where(useruploadquota.UserID(userID)).Only(ctx)
	if postgres.IsNotFound(err) {
		return upload.Quota{}, false, nil
	}
	if err != nil {
		return upload.Quota{}, false, fmt.Errorf("find upload quota of user %d: %w", userID, err)
	}
	return toQuota(row), true, nil
}

func (r *QuotaRepository) LockQuota(ctx context.Context, userID int) (upload.Quota, error) {
	row, err := r.db(ctx).UserUploadQuota.Query().Where(useruploadquota.UserID(userID)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return upload.Quota{}, upload.ErrQuotaNotFound
	}
	if err != nil {
		return upload.Quota{}, fmt.Errorf("lock upload quota of user %d: %w", userID, err)
	}
	return toQuota(row), nil
}

func (r *QuotaRepository) EnsureQuota(ctx context.Context, userID int) (upload.Quota, error) {
	err := r.db(ctx).UserUploadQuota.Create().
		SetUserID(userID).
		SetSize(0).
		SetUsed(0).
		SetIsFirstGrant(false).
		OnConflictColumns(useruploadquota.FieldUserID).
		DoNothing().
		Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return upload.Quota{}, fmt.Errorf("create upload quota of user %d: %w", userID, err)
	}
	return r.LockQuota(ctx, userID)
}

func (r *QuotaRepository) AddRecord(ctx context.Context, in upload.NewQuotaRecord) error {
	err := r.db(ctx).UserUploadQuotaRecord.Create().
		SetUserUploadQuotaID(in.QuotaID).
		SetField(useruploadquotarecord.Field(in.Field)).
		SetAction(useruploadquotarecord.Action(in.Action)).
		SetAmount(in.Amount).
		SetNillableActionReason(in.Reason).
		SetNillableUploadSessionID(in.SessionID).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("create upload quota record: %w", err)
	}
	return nil
}

func (r *QuotaRepository) AddUsed(ctx context.Context, quotaID int, delta int64) error {
	return r.update(ctx, quotaID, "add used", func(u *ent.UserUploadQuotaUpdateOne) { u.AddUsed(delta) })
}

func (r *QuotaRepository) AddSize(ctx context.Context, quotaID int, delta int64) error {
	return r.update(ctx, quotaID, "add size", func(u *ent.UserUploadQuotaUpdateOne) { u.AddSize(delta) })
}

func (r *QuotaRepository) SetUsed(ctx context.Context, quotaID int, used int64) error {
	return r.update(ctx, quotaID, "set used", func(u *ent.UserUploadQuotaUpdateOne) { u.SetUsed(used) })
}

func (r *QuotaRepository) MarkFirstGrant(ctx context.Context, quotaID int) error {
	return r.update(ctx, quotaID, "mark first grant", func(u *ent.UserUploadQuotaUpdateOne) { u.SetIsFirstGrant(true) })
}

func (r *QuotaRepository) update(ctx context.Context, quotaID int, action string, apply func(*ent.UserUploadQuotaUpdateOne)) error {
	update := r.db(ctx).UserUploadQuota.UpdateOneID(quotaID)
	apply(update)
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return upload.ErrQuotaNotFound
	}
	if err != nil {
		return fmt.Errorf("%s on upload quota %d: %w", action, quotaID, err)
	}
	return nil
}

func (r *QuotaRepository) FindWithdrawable(ctx context.Context, userID, sessionID int) (upload.QuotaRecord, bool, error) {
	row, err := r.db(ctx).UserUploadQuotaRecord.Query().
		Where(
			useruploadquotarecord.HasUserUploadQuotaWith(useruploadquota.UserID(userID)),
			useruploadquotarecord.UploadSessionID(sessionID),
			useruploadquotarecord.ActionIn(useruploadquotarecord.ActionUSE, useruploadquotarecord.ActionADD),
			useruploadquotarecord.StatusNEQ(useruploadquotarecord.StatusWITHDRAWN),
			useruploadquotarecord.FieldEQ(useruploadquotarecord.FieldUSED),
		).
		Order(ent.Asc(useruploadquotarecord.FieldCreated), ent.Asc(useruploadquotarecord.FieldID)).
		Limit(1).
		ForUpdate().
		All(ctx)
	if err != nil {
		return upload.QuotaRecord{}, false, fmt.Errorf("find withdrawable quota record: %w", err)
	}
	if len(row) == 0 {
		return upload.QuotaRecord{}, false, nil
	}
	return toQuotaRecord(row[0]), true, nil
}

func (r *QuotaRepository) MarkWithdrawn(ctx context.Context, recordID int) error {
	err := r.db(ctx).UserUploadQuotaRecord.UpdateOneID(recordID).SetStatus(useruploadquotarecord.StatusWITHDRAWN).Exec(ctx)
	if postgres.IsNotFound(err) {
		return upload.ErrQuotaRecordNotFound
	}
	if err != nil {
		return fmt.Errorf("withdraw quota record %d: %w", recordID, err)
	}
	return nil
}

func (r *QuotaRepository) CountApprovedFiles(ctx context.Context, userID int, since time.Time) (int, error) {
	count, err := r.db(ctx).GameDownloadResourceFile.Query().
		Where(
			gamedownloadresourcefile.CreatorID(userID),
			gamedownloadresourcefile.FileCheckStatus(checkOK),
			gamedownloadresourcefile.CreatedGTE(since.UTC()),
		).
		Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count approved files of user %d: %w", userID, err)
	}
	return count, nil
}

func (r *QuotaRepository) GrantCandidates(ctx context.Context, registeredBefore time.Time, afterID, limit int) ([]int, error) {
	return r.uploaders(ctx, afterID, limit,
		entuser.CreatedLTE(registeredBefore.UTC()),
		entuser.HasUploadQuotaWith(useruploadquota.IsFirstGrant(false)),
	)
}

func (r *QuotaRepository) ActiveUploaders(ctx context.Context, afterID, limit int) ([]int, error) {
	return r.uploaders(ctx, afterID, limit, entuser.HasUploadQuota())
}

func (r *QuotaRepository) InactiveUploaders(ctx context.Context, lastSeenBefore time.Time, afterID, limit int) ([]int, error) {
	return r.uploaders(ctx, afterID, limit,
		entuser.HasUploadQuota(),
		entuser.Not(entuser.HasSessionsWith(userloginsession.UpdatedGTE(lastSeenBefore.UTC()))),
	)
}

func (r *QuotaRepository) uploaders(ctx context.Context, afterID, limit int, extra ...predicate.User) ([]int, error) {
	predicates := append([]predicate.User{
		entuser.Status(userActive),
		entuser.Role(roleUser),
		entuser.IDGT(afterID),
	}, extra...)
	ids, err := r.db(ctx).User.Query().
		Where(predicates...).
		Order(ent.Asc(entuser.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list quota users: %w", err)
	}
	return ids, nil
}

func toQuota(row *ent.UserUploadQuota) upload.Quota {
	return upload.Quota{
		ID:           row.ID,
		UserID:       row.UserID,
		Size:         row.Size,
		Used:         row.Used,
		IsFirstGrant: row.IsFirstGrant,
	}
}

func toQuotaRecord(row *ent.UserUploadQuotaRecord) upload.QuotaRecord {
	return upload.QuotaRecord{
		ID:        row.ID,
		QuotaID:   row.UserUploadQuotaID,
		Field:     upload.QuotaField(row.Field),
		Action:    upload.QuotaAction(row.Action),
		Amount:    row.Amount,
		Reason:    row.ActionReason,
		SessionID: row.UploadSessionID,
		Withdrawn: row.Status == useruploadquotarecord.StatusWITHDRAWN,
	}
}
