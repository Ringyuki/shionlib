package upload_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const day = 24 * time.Hour

func TestTiersFollowApprovalsGrantsAndViolations(t *testing.T) {
	rules := upload.TierRules{RegularAfter: 3, TrustedAfter: 30, ViolationWindow: 90 * day, Freeze: 30 * day}
	ago := func(d time.Duration) *time.Time { at := now.Add(-d); return &at }
	cases := []struct {
		name     string
		standing upload.Standing
		tier     upload.Tier
		frozen   bool
	}{
		{"admins", upload.Standing{Role: actor.RoleAdmin, LastViolation: ago(day)}, upload.TierAdmin, false},
		{"newcomers", upload.Standing{Role: actor.RoleUser, Approved: 2}, upload.TierNew, false},
		{"regulars", upload.Standing{Role: actor.RoleUser, Approved: 3}, upload.TierRegular, false},
		{"trusted by approvals", upload.Standing{Role: actor.RoleUser, Approved: 30}, upload.TierTrusted, false},
		{"trusted by grant", upload.Standing{Role: actor.RoleUser, Trusted: true}, upload.TierTrusted, false},
		{"regulars need a clean window", upload.Standing{Role: actor.RoleUser, Approved: 5, LastViolation: ago(60 * day)}, upload.TierNew, false},
		{"trusted drop one tier while frozen", upload.Standing{Role: actor.RoleUser, Approved: 40, LastViolation: ago(10 * day)}, upload.TierRegular, true},
		{"trusted recover after the freeze", upload.Standing{Role: actor.RoleUser, Approved: 40, LastViolation: ago(31 * day)}, upload.TierTrusted, false},
		{"regulars recover after the window", upload.Standing{Role: actor.RoleUser, Approved: 5, LastViolation: ago(91 * day)}, upload.TierRegular, false},
	}
	for _, tc := range cases {
		tier, frozenUntil := tc.standing.Tier(rules, now)
		if tier != tc.tier || (frozenUntil != nil) != tc.frozen {
			t.Fatalf("%s: got %s frozen until %v", tc.name, tier, frozenUntil)
		}
	}
	if _, until := (upload.Standing{Role: actor.RoleUser, Approved: 40, LastViolation: ago(10 * day)}).Tier(rules, now); !until.Equal(now.Add(20 * day)) {
		t.Fatalf("the freeze lasts from the violation: %v", until)
	}
}

func TestAdmitChecksFileSizeInFlightAndStoredLimits(t *testing.T) {
	limit, maxFile := int64(100), int64(30)
	allowance := upload.Allowance{Stored: 60, InFlight: 10, InFlightLimit: 40, StoredLimit: &limit, MaxFileSize: &maxFile}
	if err := allowance.Admit(30); err != nil {
		t.Fatalf("within every limit: %v", err)
	}
	expectCode(t, allowance.Admit(31), upload.ErrTooLarge)
	allowance.InFlight = 15
	expectCode(t, allowance.Admit(26), upload.ErrInFlightExceeded)
	allowance.InFlight, allowance.Stored = 0, 80
	expectCode(t, allowance.Admit(21), upload.ErrQuotaExceeded)
}
