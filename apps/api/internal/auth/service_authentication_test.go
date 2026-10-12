package auth_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth/authtest"
)

type gate struct {
	*fixture
	standings *authtest.Standings
	service   *auth.AuthenticationService
}

func newGate(t *testing.T) *gate {
	t.Helper()
	f := newFixture(t)
	standings := authtest.NewStandings()
	return &gate{fixture: f, standings: standings, service: auth.NewAuthenticationService(authtest.Codec{}, f.families, standings)}
}

func (g *gate) signIn(t *testing.T, standing auth.Standing) (int, auth.Tokens) {
	t.Helper()
	account := g.seedUser()
	g.standings.Set(account.ID, standing)
	tokens, err := g.sessions.Issue(context.Background(), account.ID, auth.Device{})
	if err != nil {
		t.Fatal(err)
	}
	return account.ID, tokens
}

func TestAuthenticateTellsWhoHoldsTheTokenAndWhatTheyAreNow(t *testing.T) {
	ctx := context.Background()
	g := newGate(t)
	id, tokens := g.signIn(t, auth.Standing{Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitShowSpoiler})
	who, err := g.service.Authenticate(ctx, tokens.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	want := actor.Actor{UserID: id, SessionID: tokens.SessionID, FamilyID: tokens.FamilyID, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitShowSpoiler}
	if who != want {
		t.Fatalf("authenticated %+v, want %+v", who, want)
	}
}

func TestAChangedRoleOrContentLimitAppliesToATokenIssuedBefore(t *testing.T) {
	ctx := context.Background()
	g := newGate(t)
	id, tokens := g.signIn(t, auth.Standing{Role: actor.RoleSuperAdmin, ContentLimit: actor.ContentLimitJustShow})
	if who, _ := g.service.Authenticate(ctx, tokens.AccessToken); !who.AtLeast(actor.RoleSuperAdmin) || !who.IncludesRated() {
		t.Fatalf("unexpected actor before the change %+v", who)
	}
	g.standings.Set(id, auth.Standing{Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow})
	who, err := g.service.Authenticate(ctx, tokens.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if who.UserID != id || who.AtLeast(actor.RoleAdmin) || who.IncludesRated() {
		t.Fatalf("the token kept what its holder was when it was issued: %+v", who)
	}
}

func TestAuthenticateRefusesATokenWhoseHolderIsGone(t *testing.T) {
	ctx := context.Background()
	g := newGate(t)
	id, tokens := g.signIn(t, auth.Standing{Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow})
	g.standings.Remove(id)
	who, err := g.service.Authenticate(ctx, tokens.AccessToken)
	if !errors.Is(err, auth.ErrUnauthorized) || who != actor.Guest() {
		t.Fatalf("expected a refused guest, got %+v, %v", who, err)
	}
}

func TestAuthenticateRefusesABlockedFamilyBeforeLookingAnythingUp(t *testing.T) {
	ctx := context.Background()
	g := newGate(t)
	id, tokens := g.signIn(t, auth.Standing{Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow})
	if err := g.sessions.RevokeUser(ctx, id, "user_banned"); err != nil {
		t.Fatal(err)
	}
	who, err := g.service.Authenticate(ctx, tokens.AccessToken)
	if !errors.Is(err, auth.ErrFamilyBlocked) || who != actor.Guest() || g.standings.Lookup != 0 {
		t.Fatalf("expected a blocked family and no lookup, got %+v, %v after %d lookups", who, err, g.standings.Lookup)
	}
}

func TestAuthenticateFailsWhenTheStandingCannotBeRead(t *testing.T) {
	ctx := context.Background()
	g := newGate(t)
	_, tokens := g.signIn(t, auth.Standing{Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow})
	down := errors.New("database is down")
	g.standings.Fail = down
	who, err := g.service.Authenticate(ctx, tokens.AccessToken)
	if !errors.Is(err, down) || errors.Is(err, auth.ErrUnauthorized) || who != actor.Guest() {
		t.Fatalf("expected the failure itself and a guest, got %+v, %v", who, err)
	}
}

func TestAuthenticateRefusesWhatIsNotAnAccessToken(t *testing.T) {
	g := newGate(t)
	who, err := g.service.Authenticate(context.Background(), "not-a-token")
	if !errors.Is(err, auth.ErrUnauthorized) || who != actor.Guest() {
		t.Fatalf("expected a refused guest, got %+v, %v", who, err)
	}
}
