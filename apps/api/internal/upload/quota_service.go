package upload

import (
	"context"
	"errors"
	"time"
)

type QuotaService struct {
	repo   QuotaRepository
	tx     Transactor
	policy QuotaPolicy
	now    func() time.Time
}

func NewQuotaService(repo QuotaRepository, tx Transactor, policy QuotaPolicy, now func() time.Time) *QuotaService {
	return &QuotaService{repo: repo, tx: tx, policy: policy, now: now}
}

func (q *QuotaService) Get(ctx context.Context, userID int) (Quota, error) {
	quota, found, err := q.repo.FindQuota(ctx, userID)
	if err != nil {
		return Quota{}, err
	}
	if !found {
		return Quota{UserID: userID}, nil
	}
	return quota, nil
}

func (q *QuotaService) Exceeds(ctx context.Context, userID int, amount int64) (bool, error) {
	quota, found, err := q.repo.FindQuota(ctx, userID)
	if err != nil {
		return false, err
	}
	if !found {
		return false, ErrQuotaNotFound
	}
	return quota.Used+amount > quota.Size, nil
}

func (q *QuotaService) AdjustUsed(ctx context.Context, userID int, action QuotaAction, amount int64, reason string, sessionID *int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.LockQuota(ctx, userID)
		if err != nil {
			return err
		}
		delta := -amount
		switch action {
		case ActionUse:
			if quota.Used+amount > quota.Size {
				return ErrQuotaExceeded
			}
			delta = amount
		case ActionAdd:
			if quota.Used < amount {
				return ErrQuotaUsedCantBeNegative
			}
		default:
			return errors.New("used amount adjustments accept ADD or USE")
		}
		if err := q.repo.AddRecord(ctx, NewQuotaRecord{QuotaID: quota.ID, Field: FieldUsed, Action: action, Amount: amount, Reason: optional(reason), SessionID: sessionID}); err != nil {
			return err
		}
		return q.repo.AddUsed(ctx, quota.ID, delta)
	})
}

func (q *QuotaService) AdjustSize(ctx context.Context, userID int, action QuotaAction, amount int64, reason string) (int64, error) {
	err := q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.LockQuota(ctx, userID)
		if err != nil {
			return err
		}
		delta := amount
		switch action {
		case ActionAdd:
		case ActionSub:
			delta = -amount
		default:
			return errors.New("size adjustments accept ADD or SUB")
		}
		if err := q.repo.AddRecord(ctx, NewQuotaRecord{QuotaID: quota.ID, Field: FieldSize, Action: action, Amount: amount, Reason: optional(reason)}); err != nil {
			return err
		}
		if err := q.repo.AddSize(ctx, quota.ID, delta); err != nil {
			return err
		}
		if reason == ReasonInitialGrant {
			return q.repo.MarkFirstGrant(ctx, quota.ID)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return amount, nil
}

func (q *QuotaService) Withdraw(ctx context.Context, userID, sessionID int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		record, found, err := q.repo.FindWithdrawable(ctx, userID, sessionID)
		if err != nil || !found {
			return err
		}
		delta := -record.Amount
		if record.Action == ActionUse {
			delta = record.Amount
		}
		if err := q.repo.MarkWithdrawn(ctx, record.ID); err != nil {
			return err
		}
		return q.repo.AddUsed(ctx, record.QuotaID, -delta)
	})
}

func (q *QuotaService) ResetUsed(ctx context.Context, userID int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.LockQuota(ctx, userID)
		if err != nil {
			return err
		}
		if quota.Used == 0 {
			return nil
		}
		if err := q.repo.SetUsed(ctx, quota.ID, 0); err != nil {
			return err
		}
		return q.repo.AddRecord(ctx, NewQuotaRecord{QuotaID: quota.ID, Field: FieldUsed, Action: ActionAdd, Amount: quota.Used, Reason: optional(ReasonResetUsed)})
	})
}

func (q *QuotaService) InitialGrant(ctx context.Context, userID int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.LockQuota(ctx, userID)
		if err != nil || quota.IsFirstGrant {
			return err
		}
		_, err = q.AdjustSize(ctx, userID, ActionAdd, q.policy.BaseBytes, ReasonInitialGrant)
		return err
	})
}

func (q *QuotaService) DynamicTopup(ctx context.Context, userID int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.LockQuota(ctx, userID)
		if err != nil || !quota.IsFirstGrant {
			return err
		}
		if quota.Size >= q.policy.CapBytes || quota.Size-quota.Used > q.policy.TopupThresholdBytes {
			return nil
		}
		approved, err := q.repo.CountApprovedFiles(ctx, userID, q.policy.monthStart(q.now()))
		if err != nil || approved == 0 {
			return err
		}
		_, err = q.AdjustSize(ctx, userID, ActionAdd, q.policy.TopupStepBytes, ReasonDynamicTopup)
		return err
	})
}

func (q *QuotaService) DynamicReduce(ctx context.Context, userID int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.LockQuota(ctx, userID)
		if err != nil || !quota.IsFirstGrant || quota.Size <= q.policy.BaseBytes {
			return err
		}
		if q.policy.ReduceInactiveDays <= 0 || q.policy.ReduceStepBytes <= 0 {
			return nil
		}
		cutoff := q.now().AddDate(0, 0, -q.policy.ReduceInactiveDays)
		approved, err := q.repo.CountApprovedFiles(ctx, userID, cutoff)
		if err != nil || approved > 0 {
			return err
		}
		amount := min(quota.Size-q.policy.BaseBytes, q.policy.ReduceStepBytes)
		_, err = q.AdjustSize(ctx, userID, ActionSub, amount, ReasonDynamicReduce)
		return err
	})
}

func (q *QuotaService) ResetQuota(ctx context.Context, userID int) error {
	return q.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := q.repo.LockQuota(ctx, userID)
		if err != nil || quota.Size <= 0 {
			return err
		}
		_, err = q.AdjustSize(ctx, userID, ActionSub, quota.Size, ReasonResetQuota)
		return err
	})
}

func (q *QuotaService) RunInitialGrants(ctx context.Context) error {
	cutoff := q.now().AddDate(0, 0, -q.policy.GrantAfterDays)
	return q.eachUser(ctx, func(ctx context.Context, afterID int) ([]int, error) {
		return q.repo.GrantCandidates(ctx, cutoff, afterID, quotaBatchSize)
	}, q.InitialGrant)
}

func (q *QuotaService) RunDynamicTopups(ctx context.Context) error {
	return q.eachUser(ctx, q.activeUploaders, q.DynamicTopup)
}

func (q *QuotaService) RunDynamicReductions(ctx context.Context) error {
	return q.eachUser(ctx, q.activeUploaders, q.DynamicReduce)
}

func (q *QuotaService) RunMonthlyResets(ctx context.Context) error {
	return q.eachUser(ctx, q.activeUploaders, q.ResetUsed)
}

func (q *QuotaService) RunInactiveResets(ctx context.Context) error {
	cutoff := q.now().AddDate(0, 0, -q.policy.LongestInactiveDays)
	return q.eachUser(ctx, func(ctx context.Context, afterID int) ([]int, error) {
		return q.repo.InactiveUploaders(ctx, cutoff, afterID, quotaBatchSize)
	}, q.ResetQuota)
}

func (q *QuotaService) activeUploaders(ctx context.Context, afterID int) ([]int, error) {
	return q.repo.ActiveUploaders(ctx, afterID, quotaBatchSize)
}

func (q *QuotaService) eachUser(ctx context.Context, page func(ctx context.Context, afterID int) ([]int, error), apply func(ctx context.Context, userID int) error) error {
	var errs []error
	afterID := 0
	for {
		ids, err := page(ctx, afterID)
		if err != nil {
			return errors.Join(append(errs, err)...)
		}
		for _, id := range ids {
			if err := ctx.Err(); err != nil {
				return errors.Join(append(errs, err)...)
			}
			if err := apply(ctx, id); err != nil && !errors.Is(err, ErrQuotaNotFound) {
				errs = append(errs, err)
			}
			afterID = id
		}
		if len(ids) < quotaBatchSize {
			return errors.Join(errs...)
		}
	}
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
