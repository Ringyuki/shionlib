package upload

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Tier string

const (
	TierNew     Tier = "new"
	TierRegular Tier = "regular"
	TierTrusted Tier = "trusted"
	TierAdmin   Tier = "admin"
)

type Standing struct {
	Role          actor.Role
	Approved      int
	Trusted       bool
	LastViolation *time.Time
}

type TierRules struct {
	RegularAfter    int
	TrustedAfter    int
	ViolationWindow time.Duration
	Freeze          time.Duration
}

func (s Standing) Tier(rules TierRules, now time.Time) (Tier, *time.Time) {
	if s.Role >= actor.RoleAdmin {
		return TierAdmin, nil
	}
	earned := TierNew
	if s.Approved >= rules.RegularAfter {
		earned = TierRegular
	}
	if s.Trusted || s.Approved >= rules.TrustedAfter {
		earned = TierTrusted
	}
	if s.LastViolation == nil {
		return earned, nil
	}
	tier := earned
	var frozenUntil *time.Time
	if until := s.LastViolation.Add(rules.Freeze); now.Before(until) {
		tier = demote(earned)
		frozenUntil = &until
	}
	if earned == TierRegular && now.Before(s.LastViolation.Add(rules.ViolationWindow)) {
		tier = TierNew
	}
	return tier, frozenUntil
}

func demote(tier Tier) Tier {
	if tier == TierTrusted {
		return TierRegular
	}
	return TierNew
}

type Allowance struct {
	Tier          Tier
	Approved      int
	Trusted       bool
	FrozenUntil   *time.Time
	Stored        int64
	StoredLimit   *int64
	InFlight      int64
	InFlightLimit int64
	MaxFileSize   *int64
}

func (a Allowance) Admit(size int64) error {
	if a.MaxFileSize != nil && size > *a.MaxFileSize {
		return ErrTooLarge
	}
	if a.InFlight+size > a.InFlightLimit {
		return ErrInFlightExceeded
	}
	if a.StoredLimit != nil && a.Stored+a.InFlight+size > *a.StoredLimit {
		return ErrQuotaExceeded
	}
	return nil
}
