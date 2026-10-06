package upload

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type QuotaService struct {
	repo     QuotaRepository
	settings setting.Source
	now      func() time.Time
}

func NewQuotaService(repo QuotaRepository, settings setting.Source, now func() time.Time) *QuotaService {
	return &QuotaService{repo: repo, settings: settings, now: now}
}

func (q *QuotaService) Allowance(ctx context.Context, userID int) (Allowance, error) {
	now := q.now()
	standing, err := q.repo.Standing(ctx, userID)
	if err != nil {
		return Allowance{}, err
	}
	stored, err := q.repo.StoredBytes(ctx, userID)
	if err != nil {
		return Allowance{}, err
	}
	inFlight, err := q.repo.InFlightBytes(ctx, userID, now)
	if err != nil {
		return Allowance{}, err
	}
	tier, frozenUntil := standing.Tier(TierRules{
		RegularAfter:    RegularAfter.Read(q.settings),
		TrustedAfter:    TrustedAfter.Read(q.settings),
		ViolationWindow: ViolationWindow.Read(q.settings),
		Freeze:          ViolationFreeze.Read(q.settings),
	}, now)
	allowance := Allowance{
		Tier:          tier,
		Approved:      standing.Approved,
		Trusted:       standing.Trusted,
		FrozenUntil:   frozenUntil,
		Stored:        stored,
		InFlight:      inFlight,
		InFlightLimit: InFlightLimit.Read(q.settings),
	}
	maxFileSize := MaxFileSize.Read(q.settings)
	switch tier {
	case TierNew:
		allowance.StoredLimit, allowance.MaxFileSize = bytes(NewUploaderQuota.Read(q.settings)), &maxFileSize
	case TierRegular:
		allowance.StoredLimit, allowance.MaxFileSize = bytes(RegularQuota.Read(q.settings)), &maxFileSize
	case TierTrusted:
		allowance.StoredLimit = bytes(TrustedQuota.Read(q.settings))
	}
	return allowance, nil
}

func (q *QuotaService) SetTrusted(ctx context.Context, userID int, trusted bool) error {
	return q.repo.SetTrusted(ctx, userID, trusted)
}

func bytes(value int64) *int64 {
	return &value
}
