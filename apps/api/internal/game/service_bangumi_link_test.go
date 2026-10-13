package game_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
)

func newBangumiLink(configured bool) (*game.BangumiLinkService, *gametest.BangumiAuthorizer, *gametest.BangumiStates) {
	authorizer := &gametest.BangumiAuthorizer{Configured: configured}
	states := gametest.NewBangumiStates()
	next := 0
	service := game.NewBangumiLinkService(authorizer, states, "https://shionlib.test/", func() string {
		next++
		return "state-" + string(rune('0'+next))
	})
	return service, authorizer, states
}

func TestBangumiAuthorizationRunsThroughTheSiteCallback(t *testing.T) {
	service, authorizer, states := newBangumiLink(true)
	ctx := context.Background()
	status, err := service.Status(ctx)
	if err != nil || !status.Configured || status.Authorized || status.CallbackURL != "https://shionlib.test/api/admin/bangumi/authorization/callback" {
		t.Fatalf("status %+v %v", status, err)
	}
	location, err := service.Start(ctx, "/zh/admin/catalog")
	if err != nil || location != "https://bgm.test/oauth/authorize?redirect_uri=https://shionlib.test/api/admin/bangumi/authorization/callback&state=state-1" {
		t.Fatalf("start %q %v", location, err)
	}
	if states.TTL != game.BangumiStateTTL {
		t.Fatalf("the state expires: %v", states.TTL)
	}
	returnTo, err := service.Complete(ctx, "state-1", "code-1")
	if err != nil || returnTo != "/zh/admin/catalog" {
		t.Fatalf("complete %q %v", returnTo, err)
	}
	if len(authorizer.Exchanged) != 1 || authorizer.Exchanged[0] != "code-1 https://shionlib.test/api/admin/bangumi/authorization/callback" {
		t.Fatalf("exchanged %v", authorizer.Exchanged)
	}
	if _, err := service.Complete(ctx, "state-1", "code-1"); !errors.Is(err, game.ErrBangumiAuthorizationInvalid) {
		t.Fatalf("a state completes once: %v", err)
	}
	if status, _ := service.Status(ctx); !status.Authorized {
		t.Fatalf("authorized afterwards: %+v", status)
	}
}

func TestBangumiAuthorizationRefusesWhatItDidNotStart(t *testing.T) {
	service, authorizer, _ := newBangumiLink(true)
	ctx := context.Background()
	if _, err := service.Complete(ctx, "", "code"); !errors.Is(err, game.ErrBangumiAuthorizationInvalid) {
		t.Fatalf("no state: %v", err)
	}
	if _, err := service.Complete(ctx, "forged", "code"); !errors.Is(err, game.ErrBangumiAuthorizationInvalid) {
		t.Fatalf("an unknown state: %v", err)
	}
	if _, err := service.Start(ctx, "https://evil.test/"); err != nil {
		t.Fatal(err)
	}
	returnTo, err := service.Complete(ctx, "state-1", "")
	if !errors.Is(err, game.ErrBangumiAuthorizationInvalid) || returnTo != "/" {
		t.Fatalf("a denied authorization returns to a safe path: %q %v", returnTo, err)
	}
	if _, err := service.Start(ctx, "//evil.test/x"); err != nil {
		t.Fatal(err)
	}
	authorizer.ExchangeErr = game.ErrBangumiRequestFailed
	returnTo, err = service.Complete(ctx, "state-2", "code")
	if !errors.Is(err, game.ErrBangumiRequestFailed) || returnTo != "/" {
		t.Fatalf("a failed exchange: %q %v", returnTo, err)
	}
	if len(authorizer.Exchanged) != 0 {
		t.Fatalf("nothing was exchanged: %v", authorizer.Exchanged)
	}
}

func TestBangumiAuthorizationNeedsCredentials(t *testing.T) {
	service, _, _ := newBangumiLink(false)
	if _, err := service.Start(context.Background(), "/zh/admin/catalog"); !errors.Is(err, game.ErrBangumiNotConfigured) {
		t.Fatalf("expected not configured, got %v", err)
	}
}
