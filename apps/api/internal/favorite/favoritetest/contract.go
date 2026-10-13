package favoritetest

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
)

type Env struct {
	Repo    favorite.Repository
	NewUser func(t *testing.T) int
	NewGame func(t *testing.T) int
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("create then get and find by exact name", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		description := "my list"
		created, err := env.Repo.Create(ctx, favorite.NewFavorite{UserID: user, Name: "Lists", Description: &description, IsPrivate: true})
		if err != nil {
			t.Fatal(err)
		}
		if created.ID == 0 || created.UserID != user || created.Name != "Lists" || created.Default || !created.IsPrivate || created.Description == nil || *created.Description != description {
			t.Fatalf("unexpected created favorite %+v", created)
		}
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil || got.ID != created.ID {
			t.Fatalf("get: %+v %v", got, err)
		}
		if _, found, err := env.Repo.FindByName(ctx, user, "lists"); err != nil || found {
			t.Fatalf("name lookup must be case sensitive: found=%v err=%v", found, err)
		}
		if found, ok, err := env.Repo.FindByName(ctx, user, "Lists"); err != nil || !ok || found.ID != created.ID {
			t.Fatalf("find by name: %+v %v %v", found, ok, err)
		}
	})

	t.Run("missing rows are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, favorite.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, favorite.ErrNotFound) {
			t.Fatalf("lock: %v", err)
		}
		if err := env.Repo.Update(ctx, 987654, favorite.Changes{}); !errors.Is(err, favorite.ErrNotFound) {
			t.Fatalf("update: %v", err)
		}
		if err := env.Repo.Delete(ctx, 987654); !errors.Is(err, favorite.ErrNotFound) {
			t.Fatalf("delete: %v", err)
		}
		if _, err := env.Repo.GetItem(ctx, 987654); !errors.Is(err, favorite.ErrItemNotFound) {
			t.Fatalf("get item: %v", err)
		}
		if err := env.Repo.UpdateItemNote(ctx, 987654, "x"); !errors.Is(err, favorite.ErrItemNotFound) {
			t.Fatalf("update item: %v", err)
		}
		if err := env.Repo.DeleteItem(ctx, 987654); !errors.Is(err, favorite.ErrItemNotFound) {
			t.Fatalf("delete item: %v", err)
		}
		if err := env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: 987654, GameID: env.NewGame(t)}); !errors.Is(err, favorite.ErrNotFound) {
			t.Fatalf("create item for missing favorite: %v", err)
		}
	})

	t.Run("unique names are enforced per user", func(t *testing.T) {
		env := newEnv(t)
		alice, bob := env.NewUser(t), env.NewUser(t)
		first, err := env.Repo.Create(ctx, favorite.NewFavorite{UserID: alice, Name: "Dup"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Create(ctx, favorite.NewFavorite{UserID: alice, Name: "Dup"}); !errors.Is(err, favorite.ErrAlreadyExists) {
			t.Fatalf("duplicate create: %v", err)
		}
		if _, err := env.Repo.Create(ctx, favorite.NewFavorite{UserID: bob, Name: "Dup"}); err != nil {
			t.Fatalf("other user may reuse the name: %v", err)
		}
		second, err := env.Repo.Create(ctx, favorite.NewFavorite{UserID: alice, Name: "Other"})
		if err != nil {
			t.Fatal(err)
		}
		name := first.Name
		if err := env.Repo.Update(ctx, second.ID, favorite.Changes{Name: &name}); !errors.Is(err, favorite.ErrNameAlreadyExists) {
			t.Fatalf("rename onto existing name: %v", err)
		}
	})

	t.Run("update applies only provided fields", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		description := "before"
		fav, err := env.Repo.Create(ctx, favorite.NewFavorite{UserID: user, Name: "Before", Description: &description})
		if err != nil {
			t.Fatal(err)
		}
		private := true
		if err := env.Repo.Update(ctx, fav.ID, favorite.Changes{IsPrivate: &private}); err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Get(ctx, fav.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Name != "Before" || got.Description == nil || *got.Description != "before" || !got.IsPrivate {
			t.Fatalf("unexpected favorite after partial update %+v", got)
		}
		name, newDescription := "After", "after"
		if err := env.Repo.Update(ctx, fav.ID, favorite.Changes{Name: &name, Description: &newDescription}); err != nil {
			t.Fatal(err)
		}
		got, _ = env.Repo.Get(ctx, fav.ID)
		if got.Name != "After" || *got.Description != "after" || !got.IsPrivate {
			t.Fatalf("unexpected favorite after full update %+v", got)
		}
	})

	t.Run("items are unique per favorite and carry the owner", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		game := env.NewGame(t)
		fav, err := env.Repo.Create(ctx, favorite.NewFavorite{UserID: user, Name: "Games"})
		if err != nil {
			t.Fatal(err)
		}
		note := "note"
		if err := env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: fav.ID, GameID: game, Note: &note}); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: fav.ID, GameID: game}); !errors.Is(err, favorite.ErrItemAlreadyExists) {
			t.Fatalf("duplicate item: %v", err)
		}
		item, found, err := env.Repo.FindItem(ctx, fav.ID, game)
		if err != nil || !found {
			t.Fatalf("find item: %v %v", found, err)
		}
		if item.OwnerID != user || item.GameID != game || item.Note == nil || *item.Note != note {
			t.Fatalf("unexpected item %+v", item)
		}
		if err := env.Repo.UpdateItemNote(ctx, item.ID, "changed"); err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.GetItem(ctx, item.ID)
		if err != nil || got.Note == nil || *got.Note != "changed" || got.OwnerID != user {
			t.Fatalf("get item after update: %+v %v", got, err)
		}
		if has, err := env.Repo.HasGame(ctx, user, game); err != nil || !has {
			t.Fatalf("has game: %v %v", has, err)
		}
		if has, err := env.Repo.HasGame(ctx, env.NewUser(t), game); err != nil || has {
			t.Fatalf("has game for another user: %v %v", has, err)
		}
		if err := env.Repo.DeleteItem(ctx, item.ID); err != nil {
			t.Fatal(err)
		}
		if _, found, _ := env.Repo.FindItem(ctx, fav.ID, game); found {
			t.Fatal("item still present after delete")
		}
	})

	t.Run("deleting a favorite cascades to its items", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		fav, _ := env.Repo.Create(ctx, favorite.NewFavorite{UserID: user, Name: "Gone"})
		if err := env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: fav.ID, GameID: env.NewGame(t)}); err != nil {
			t.Fatal(err)
		}
		items, _, _ := env.Repo.ListItems(ctx, fav.ID, favorite.Page{Number: 1, Size: 10})
		if err := env.Repo.Delete(ctx, fav.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.GetItem(ctx, items[0].ID); !errors.Is(err, favorite.ErrItemNotFound) {
			t.Fatalf("item survived favorite deletion: %v", err)
		}
	})

	t.Run("list filters visibility and counts games", func(t *testing.T) {
		env := newEnv(t)
		owner := env.NewUser(t)
		game, otherGame := env.NewGame(t), env.NewGame(t)
		public, _ := env.Repo.Create(ctx, favorite.NewFavorite{UserID: owner, Name: "Public"})
		private, _ := env.Repo.Create(ctx, favorite.NewFavorite{UserID: owner, Name: "Private", IsPrivate: true})
		_ = env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: public.ID, GameID: game})
		_ = env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: public.ID, GameID: otherGame})
		_ = env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: private.ID, GameID: otherGame})

		all, err := env.Repo.List(ctx, favorite.ListFilter{OwnerID: owner})
		if err != nil {
			t.Fatal(err)
		}
		if len(all) != 2 || all[0].ID != public.ID || all[0].GameCount != 2 || all[1].GameCount != 1 || all[0].IsFavorite != nil {
			t.Fatalf("unexpected owner listing %+v", all)
		}
		visible, err := env.Repo.List(ctx, favorite.ListFilter{OwnerID: owner, PublicOnly: true, ContainGame: &game})
		if err != nil {
			t.Fatal(err)
		}
		if len(visible) != 1 || visible[0].ID != public.ID || visible[0].IsFavorite == nil || !*visible[0].IsFavorite {
			t.Fatalf("unexpected public listing %+v", visible)
		}
		none, err := env.Repo.List(ctx, favorite.ListFilter{OwnerID: env.NewUser(t)})
		if err != nil || len(none) != 0 {
			t.Fatalf("unexpected listing for user without favorites %+v %v", none, err)
		}
	})

	t.Run("items are paginated newest first", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		fav, _ := env.Repo.Create(ctx, favorite.NewFavorite{UserID: user, Name: "Paged"})
		var games []int
		for range 3 {
			game := env.NewGame(t)
			games = append(games, game)
			if err := env.Repo.CreateItem(ctx, favorite.NewItem{FavoriteID: fav.ID, GameID: game}); err != nil {
				t.Fatal(err)
			}
		}
		first, total, err := env.Repo.ListItems(ctx, fav.ID, favorite.Page{Number: 1, Size: 2})
		if err != nil {
			t.Fatal(err)
		}
		second, _, err := env.Repo.ListItems(ctx, fav.ID, favorite.Page{Number: 2, Size: 2})
		if err != nil {
			t.Fatal(err)
		}
		if total != 3 || len(first) != 2 || len(second) != 1 {
			t.Fatalf("unexpected pagination total=%d first=%d second=%d", total, len(first), len(second))
		}
		if first[0].GameID != games[2] || first[1].GameID != games[1] || second[0].GameID != games[0] {
			t.Fatalf("items are not newest first: %+v %+v", first, second)
		}
	})
}
