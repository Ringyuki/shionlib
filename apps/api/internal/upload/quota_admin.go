package upload

import (
	"cmp"
	"context"
	"errors"
)

const (
	ReasonAdminAdjust    = "ADMIN_ADJUST"
	ReasonAdminResetUsed = "ADMIN_RESET_USED"
)

func (q *QuotaService) AdminAdjustSize(ctx context.Context, userID int, action QuotaAction, amount int64, reason string) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.EnsureQuota(ctx, userID)
		if err != nil {
			return err
		}
		delta := amount
		switch action {
		case ActionAdd:
		case ActionSub:
			if quota.Size-amount < quota.Used {
				return ErrQuotaExceeded
			}
			delta = -amount
		default:
			return errors.New("size adjustments accept ADD or SUB")
		}
		if err := q.repo.AddRecord(ctx, NewQuotaRecord{QuotaID: quota.ID, Field: FieldSize, Action: action, Amount: amount, Reason: optional(cmp.Or(reason, ReasonAdminAdjust))}); err != nil {
			return err
		}
		return q.repo.AddSize(ctx, quota.ID, delta)
	})
}

func (q *QuotaService) AdminAdjustUsed(ctx context.Context, userID int, action QuotaAction, amount int64, reason string) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := q.repo.EnsureQuota(ctx, userID); err != nil {
			return err
		}
		return q.AdjustUsed(ctx, userID, action, amount, cmp.Or(reason, ReasonAdminAdjust), nil)
	})
}

func (q *QuotaService) AdminResetUsed(ctx context.Context, userID int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.EnsureQuota(ctx, userID)
		if err != nil {
			return err
		}
		return q.resetUsed(ctx, quota, ReasonAdminResetUsed)
	})
}
