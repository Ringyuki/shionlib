package actor_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

func TestGuestsAreNeverAuthenticated(t *testing.T) {
	guest := actor.Guest()
	if guest.Authenticated() || guest.AtLeast(actor.RoleUser) || guest.IncludesRated() {
		t.Fatalf("guest %+v", guest)
	}
	if got := actor.From(context.Background()); got != guest {
		t.Fatalf("a context without an actor carries the guest: %+v", got)
	}
}

func TestRolesAreOrdered(t *testing.T) {
	admin := actor.Actor{UserID: 1, Role: actor.RoleAdmin}
	if !admin.AtLeast(actor.RoleUser) || !admin.AtLeast(actor.RoleAdmin) || admin.AtLeast(actor.RoleSuperAdmin) {
		t.Fatalf("admin %+v", admin)
	}
	if got := actor.From(actor.With(context.Background(), admin)); got != admin {
		t.Fatalf("round trip %+v", got)
	}
}

func TestContentLimits(t *testing.T) {
	cases := map[actor.ContentLimit][2]bool{
		actor.ContentLimitGuest:       {false, false},
		actor.ContentLimitNeverShow:   {true, false},
		actor.ContentLimitShowSpoiler: {true, true},
		actor.ContentLimitJustShow:    {true, true},
	}
	for limit, want := range cases {
		if limit.Valid() != want[0] || limit.IncludesRated() != want[1] {
			t.Fatalf("limit %d: valid %v rated %v", limit, limit.Valid(), limit.IncludesRated())
		}
	}
}
