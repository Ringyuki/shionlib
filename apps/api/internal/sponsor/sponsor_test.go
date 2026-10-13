package sponsor_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func TestBadgeUntilTellsWhatAnOrderGivesItsSponsor(t *testing.T) {
	now := time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)
	day := 24 * time.Hour
	running := now.Add(10 * day)
	lapsed := now.Add(-day)
	cases := []struct {
		name  string
		order sponsor.Order
		want  *time.Time
	}{
		{"an order without an account gives no badge", sponsor.Order{Status: sponsor.StatusNew, AmountCents: 1000}, nil},
		{"a waiting order counts from now", sponsor.Order{Status: sponsor.StatusNew, AmountCents: 1000, User: &user.Summary{ID: 1}}, at(now.Add(60 * day))},
		{"a waiting order adds to a badge that still runs", sponsor.Order{Status: sponsor.StatusNew, AmountCents: 500, User: &user.Summary{ID: 1, SponsorExpiresAt: &running}}, at(now.Add(40 * day))},
		{"a waiting order ignores a badge that ran out", sponsor.Order{Status: sponsor.StatusNew, AmountCents: 500, User: &user.Summary{ID: 1, SponsorExpiresAt: &lapsed}}, at(now.Add(30 * day))},
		{"a waiting order too small for a day gives nothing", sponsor.Order{Status: sponsor.StatusNew, AmountCents: 10, User: &user.Summary{ID: 1}}, nil},
		{"a paid order shows the badge as it stands", sponsor.Order{Status: sponsor.StatusDone, AmountCents: 500, User: &user.Summary{ID: 1, SponsorExpiresAt: &running}}, &running},
		{"a paid order whose badge ran out shows none", sponsor.Order{Status: sponsor.StatusDone, AmountCents: 500, User: &user.Summary{ID: 1, SponsorExpiresAt: &lapsed}}, nil},
		{"an expired order gives nothing", sponsor.Order{Status: sponsor.StatusExpired, AmountCents: 500, User: &user.Summary{ID: 1, SponsorExpiresAt: &running}}, nil},
	}
	for _, c := range cases {
		got := c.order.BadgeUntil(now)
		if (got == nil) != (c.want == nil) || (got != nil && !got.Equal(*c.want)) {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func at(moment time.Time) *time.Time {
	return &moment
}
