package moyupg_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/patchpageassignment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moyupg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

func TestAssignments(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := moyupg.NewAssignmentStore(db.Ent)
	admin := db.User(t)
	hidden := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v2240").SetNsfw(true).SetStatus(2) })

	found, err := store.Assigned(ctx, hidden)
	if err != nil || found.Assigned || len(found.Anchors) != 1 {
		t.Fatalf("an administrator sees hidden and rated games: %+v %v", found, err)
	}
	if err := store.Assign(ctx, hidden, []string{"10363", "211655"}, admin); err != nil {
		t.Fatal(err)
	}
	if err := store.Assign(ctx, hidden, []string{"211652", "10363"}, admin); err != nil {
		t.Fatal(err)
	}
	found, err = store.Assigned(ctx, hidden)
	if err != nil || !found.Assigned || !slices.Equal(found.Pages, []string{"211652", "10363"}) {
		t.Fatalf("a second assignment replaces the first, in its order: %+v %v", found, err)
	}
	row := db.Ent.PatchPageAssignment.Query().Where(patchpageassignment.GameID(hidden)).OnlyX(ctx)
	if row.AssignedBy == nil || *row.AssignedBy != admin {
		t.Fatalf("who assigned them: %+v", row)
	}
	if err := store.Assign(ctx, hidden, nil, admin); err != nil {
		t.Fatal(err)
	}
	if found, err := store.Assigned(ctx, hidden); err != nil || !found.Assigned || len(found.Pages) != 0 {
		t.Fatalf("no pages is an assignment too: %+v %v", found, err)
	}
	if err := store.Unassign(ctx, hidden); err != nil {
		t.Fatal(err)
	}
	if found, err := store.Assigned(ctx, hidden); err != nil || found.Assigned {
		t.Fatalf("back to the ids: %+v %v", found, err)
	}
	if err := store.Unassign(ctx, hidden); err != nil {
		t.Fatalf("unassigning twice: %v", err)
	}
	if _, err := store.Assigned(ctx, 987654); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	if err := store.Assign(ctx, hidden, []string{"1"}, 0); err != nil {
		t.Fatal(err)
	}
	db.Ent.Game.DeleteOneID(hidden).ExecX(ctx)
	if count := db.Ent.PatchPageAssignment.Query().CountX(ctx); count != 0 {
		t.Fatalf("an assignment goes with its game: %d left", count)
	}
}
