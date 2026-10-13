package authpg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/authpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

func TestStandingIsWhatTheUserIsNow(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	store := authpg.NewStandingStore(db.Ent)
	id := db.User(t)
	standing, found, err := store.Standing(ctx, id)
	if err != nil || !found || standing != (auth.Standing{Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}) {
		t.Fatalf("unexpected standing of a new user %+v, %v, %v", standing, found, err)
	}
	if err := db.Ent.User.UpdateOneID(id).SetRole(int(actor.RoleAdmin)).SetContentLimit(int(actor.ContentLimitJustShow)).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	standing, found, err = store.Standing(ctx, id)
	if err != nil || !found || standing != (auth.Standing{Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitJustShow}) {
		t.Fatalf("the change is not read back: %+v, %v, %v", standing, found, err)
	}
}

func TestStandingOfAUserThatDoesNotExist(t *testing.T) {
	db := pgtest.New(t)
	standing, found, err := authpg.NewStandingStore(db.Ent).Standing(context.Background(), 987654321)
	if err != nil || found || standing != (auth.Standing{}) {
		t.Fatalf("expected nothing, got %+v, %v, %v", standing, found, err)
	}
}
