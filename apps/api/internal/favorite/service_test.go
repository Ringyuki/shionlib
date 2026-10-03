package favorite_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite/favoritetest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

var (
	alice = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	bob   = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	guest = actor.Guest()
)

type fixture struct {
	repo    *favoritetest.MemoryRepository
	tx      *favoritetest.ImmediateTransactor
	service *favorite.Service
}

func newFixture(cards ...game.Card) fixture {
	clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	repo := favoritetest.NewMemoryRepository(func() time.Time {
		clock = clock.Add(time.Second)
		return clock
	})
	tx := &favoritetest.ImmediateTransactor{}
	return fixture{repo: repo, tx: tx, service: favorite.NewService(repo, favoritetest.NewGames(cards...), tx)}
}

func ptr[T any](v T) *T {
	return &v
}

func TestCreate(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created, err := f.service.Create(ctx, alice, favorite.CreateInput{Name: "Reading", Description: ptr("desc"), IsPrivate: true})
	if err != nil {
		t.Fatal(err)
	}
	if created.UserID != alice.UserID || created.Name != "Reading" || !created.IsPrivate || created.Default {
		t.Fatalf("unexpected favorite %+v", created)
	}
	if _, err := f.service.Create(ctx, alice, favorite.CreateInput{Name: "Reading"}); !errors.Is(err, favorite.ErrAlreadyExists) {
		t.Fatalf("duplicate name: %v", err)
	}
	if _, err := f.service.Create(ctx, bob, favorite.CreateInput{Name: "Reading"}); err != nil {
		t.Fatalf("names are scoped per user: %v", err)
	}
}

func TestUpdate(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	first := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "First"})
	second := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "Second"})

	if err := f.service.Update(ctx, alice, 999, favorite.Changes{}); !errors.Is(err, favorite.ErrNotFound) {
		t.Fatalf("missing favorite: %v", err)
	}
	if err := f.service.Update(ctx, bob, first.ID, favorite.Changes{IsPrivate: ptr(true)}); !errors.Is(err, favorite.ErrNotOwner) {
		t.Fatalf("not owner: %v", err)
	}
	if err := f.service.Update(ctx, alice, second.ID, favorite.Changes{Name: ptr("First")}); !errors.Is(err, favorite.ErrNameAlreadyExists) {
		t.Fatalf("name conflict: %v", err)
	}
	if err := f.service.Update(ctx, alice, first.ID, favorite.Changes{Name: ptr("First")}); err != nil {
		t.Fatalf("keeping the same name is allowed: %v", err)
	}
	if err := f.service.Update(ctx, alice, second.ID, favorite.Changes{IsPrivate: ptr(true)}); err != nil {
		t.Fatalf("updating without a name must not run the name check: %v", err)
	}
	got, _ := f.repo.Get(ctx, second.ID)
	if !got.IsPrivate || got.Name != "Second" {
		t.Fatalf("unexpected favorite after update %+v", got)
	}
	if f.tx.Calls == 0 {
		t.Fatal("update must run inside a transaction")
	}
}

func TestDelete(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	defaultList := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "default", Default: true})
	custom := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "custom"})

	if err := f.service.Delete(ctx, alice, 999); !errors.Is(err, favorite.ErrNotFound) {
		t.Fatalf("missing favorite: %v", err)
	}
	if err := f.service.Delete(ctx, bob, custom.ID); !errors.Is(err, favorite.ErrNotOwner) {
		t.Fatalf("not owner: %v", err)
	}
	if err := f.service.Delete(ctx, alice, defaultList.ID); !errors.Is(err, favorite.ErrDefaultNotAllowDelete) {
		t.Fatalf("default list: %v", err)
	}
	if err := f.service.Delete(ctx, alice, custom.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.Get(ctx, custom.ID); !errors.Is(err, favorite.ErrNotFound) {
		t.Fatalf("favorite was not deleted: %v", err)
	}
}

func TestAddGame(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: 10})
	fav := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "list"})

	cases := []struct {
		name       string
		who        actor.Actor
		favoriteID int
		gameID     int
		want       error
	}{
		{name: "missing favorite", who: alice, favoriteID: 999, gameID: 10, want: favorite.ErrNotFound},
		{name: "not owner", who: bob, favoriteID: fav.ID, gameID: 10, want: favorite.ErrNotOwner},
		{name: "missing game", who: alice, favoriteID: fav.ID, gameID: 404, want: game.ErrNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := f.service.AddGame(ctx, tc.who, tc.favoriteID, tc.gameID, nil); !errors.Is(err, tc.want) {
				t.Fatalf("got %v want %v", err, tc.want)
			}
		})
	}
	if err := f.service.AddGame(ctx, alice, fav.ID, 10, ptr("note")); err != nil {
		t.Fatal(err)
	}
	if err := f.service.AddGame(ctx, alice, fav.ID, 10, nil); !errors.Is(err, favorite.ErrItemAlreadyExists) {
		t.Fatalf("duplicate item: %v", err)
	}
}

func TestItemOwnership(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: 10}, game.Card{ID: 11})
	fav := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "list"})
	if err := f.service.AddGame(ctx, alice, fav.ID, 10, nil); err != nil {
		t.Fatal(err)
	}
	item, _, _ := f.repo.FindItem(ctx, fav.ID, 10)

	if err := f.service.UpdateItem(ctx, bob, item.ID, ptr("x")); !errors.Is(err, favorite.ErrItemNotOwner) {
		t.Fatalf("update foreign item: %v", err)
	}
	if err := f.service.UpdateItem(ctx, alice, 999, ptr("x")); !errors.Is(err, favorite.ErrItemNotFound) {
		t.Fatalf("update missing item: %v", err)
	}
	if err := f.service.UpdateItem(ctx, alice, item.ID, nil); err != nil {
		t.Fatalf("omitting the note is a no-op: %v", err)
	}
	if err := f.service.UpdateItem(ctx, alice, item.ID, ptr("hello")); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetItem(ctx, item.ID); got.Note == nil || *got.Note != "hello" {
		t.Fatalf("note not updated: %+v", got)
	}
	if err := f.service.DeleteItem(ctx, bob, item.ID); !errors.Is(err, favorite.ErrItemNotOwner) {
		t.Fatalf("delete foreign item: %v", err)
	}
	if err := f.service.DeleteItem(ctx, alice, item.ID); err != nil {
		t.Fatal(err)
	}
}

func TestRemoveGameChecksOwnershipBeforeExistence(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: 10})
	fav := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "list"})
	if err := f.service.AddGame(ctx, alice, fav.ID, 10, nil); err != nil {
		t.Fatal(err)
	}
	if err := f.service.RemoveGame(ctx, alice, 999, 10); !errors.Is(err, favorite.ErrItemNotFound) {
		t.Fatalf("missing favorite: %v", err)
	}
	if err := f.service.RemoveGame(ctx, bob, fav.ID, 12345); !errors.Is(err, favorite.ErrItemNotOwner) {
		t.Fatalf("non-owner must not learn whether the item exists: %v", err)
	}
	if err := f.service.RemoveGame(ctx, alice, fav.ID, 12345); !errors.Is(err, favorite.ErrItemNotFound) {
		t.Fatalf("missing item: %v", err)
	}
	if err := f.service.RemoveGame(ctx, alice, fav.ID, 10); err != nil {
		t.Fatal(err)
	}
	if _, found, _ := f.repo.FindItem(ctx, fav.ID, 10); found {
		t.Fatal("item was not removed")
	}
}

func TestList(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: 10})
	public := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "public"})
	f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "private", IsPrivate: true})
	if err := f.service.AddGame(ctx, alice, public.ID, 10, nil); err != nil {
		t.Fatal(err)
	}

	if _, err := f.service.List(ctx, guest, favorite.ListQuery{GameID: ptr(10)}); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("guest with game_id: %v", err)
	}
	if got, err := f.service.List(ctx, guest, favorite.ListQuery{}); err != nil || len(got) != 0 {
		t.Fatalf("guests without a target user must see nothing: %+v %v", got, err)
	}
	own, err := f.service.List(ctx, alice, favorite.ListQuery{})
	if err != nil || len(own) != 2 {
		t.Fatalf("owner sees private lists: %+v %v", own, err)
	}
	others, err := f.service.List(ctx, bob, favorite.ListQuery{UserID: ptr(alice.UserID), GameID: ptr(10)})
	if err != nil || len(others) != 1 || others[0].ID != public.ID || others[0].GameCount != 1 || others[0].IsFavorite == nil || !*others[0].IsFavorite {
		t.Fatalf("other users see public lists with membership: %+v %v", others, err)
	}
	guestView, err := f.service.List(ctx, guest, favorite.ListQuery{UserID: ptr(alice.UserID)})
	if err != nil || len(guestView) != 1 {
		t.Fatalf("guest viewing a user sees public lists: %+v %v", guestView, err)
	}
}

func TestItemsVisibilityAndCards(t *testing.T) {
	ctx := context.Background()
	rated := game.Card{ID: 10, TitleJP: "rated", Covers: []game.Cover{{URL: "safe"}, {URL: "rated", Sexual: 2}}}
	f := newFixture(rated, game.Card{ID: 11})
	private := f.repo.Seed(favorite.Favorite{UserID: bob.UserID, Name: "private", IsPrivate: true})
	public := f.repo.Seed(favorite.Favorite{UserID: bob.UserID, Name: "public"})
	if err := f.service.AddGame(ctx, bob, public.ID, 10, nil); err != nil {
		t.Fatal(err)
	}

	if _, _, err := f.service.Items(ctx, alice, private.ID, favorite.Page{Number: 1, Size: 10}); !errors.Is(err, favorite.ErrNotAllowView) {
		t.Fatalf("private list for another user: %v", err)
	}
	if _, _, err := f.service.Items(ctx, bob, private.ID, favorite.Page{Number: 1, Size: 10}); err != nil {
		t.Fatalf("owner can read the private list: %v", err)
	}
	strict, total, err := f.service.Items(ctx, alice, public.ID, favorite.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || len(strict) != 1 {
		t.Fatalf("items: %+v %d %v", strict, total, err)
	}
	if covers := strict[0].Game.Covers; len(covers) != 1 || covers[0].URL != "safe" {
		t.Fatalf("strict viewers must not see rated covers: %+v", covers)
	}
	permissive, _, _ := f.service.Items(ctx, bob, public.ID, favorite.Page{Number: 1, Size: 10})
	if len(permissive[0].Game.Covers) != 2 {
		t.Fatalf("permissive viewers see every cover: %+v", permissive[0].Game.Covers)
	}
	if _, _, err := f.service.Items(ctx, alice, 999, favorite.Page{Number: 1, Size: 10}); !errors.Is(err, favorite.ErrNotFound) {
		t.Fatalf("missing list: %v", err)
	}
}

func TestHasGame(t *testing.T) {
	ctx := context.Background()
	f := newFixture(game.Card{ID: 10})
	fav := f.repo.Seed(favorite.Favorite{UserID: alice.UserID, Name: "list"})
	if has, _ := f.service.HasGame(ctx, alice, 10); has {
		t.Fatal("game is not in any list yet")
	}
	if err := f.service.AddGame(ctx, alice, fav.ID, 10, nil); err != nil {
		t.Fatal(err)
	}
	if has, _ := f.service.HasGame(ctx, alice, 10); !has {
		t.Fatal("game should be reported as favorited")
	}
	if has, _ := f.service.HasGame(ctx, bob, 10); has {
		t.Fatal("membership is per user")
	}
}
