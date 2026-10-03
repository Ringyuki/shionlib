package catalogtest

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type Env struct {
	Store     catalog.Store
	CreatorID func(t *testing.T) int
}

const contractSource = catalog.SourceHikarinagi

func GameRecord(externalID string, developers []string, characters []string) catalog.GameRecord {
	record := catalog.GameRecord{ExternalID: externalID, TitleJP: "ゲーム" + externalID}
	for _, id := range developers {
		record.Developers = append(record.Developers, catalog.DeveloperLink{ExternalID: id, Name: "dev " + id, Role: "开发"})
	}
	for _, id := range characters {
		record.Characters = append(record.Characters, catalog.CharacterLink{ExternalID: id, NameJP: "chara " + id, Role: "main"})
	}
	return record
}

func StoreContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	at := time.Date(2026, 10, 3, 8, 0, 0, 0, time.UTC)
	ref := func(entity catalog.Entity, id string) catalog.Ref {
		return catalog.Ref{Source: contractSource, Entity: entity, ExternalID: id}
	}

	t.Run("applying a game links it and reports credits that were never synced", func(t *testing.T) {
		env := newEnv(t)
		creator := env.CreatorID(t)
		id, related, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("9001", []string{"801", "802"}, []string{"701"}), creator, at)
		if err != nil {
			t.Fatal(err)
		}
		want := []catalog.Ref{ref(catalog.EntityDeveloper, "801"), ref(catalog.EntityDeveloper, "802"), ref(catalog.EntityCharacter, "701")}
		if !slices.Equal(related, want) {
			t.Fatalf("related refs %v, want %v", related, want)
		}
		local, ok, err := env.Store.LocalID(ctx, ref(catalog.EntityGame, "9001"))
		if err != nil || !ok || local != id {
			t.Fatalf("local id %d %v %v, want %d", local, ok, err, id)
		}
		again, related, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("9001", []string{"801", "802"}, []string{"701"}), creator, at)
		if err != nil || again != id || len(related) != 3 {
			t.Fatalf("reapply returned %d %v %v", again, related, err)
		}
		placeholder, ok, err := env.Store.LocalID(ctx, ref(catalog.EntityDeveloper, "801"))
		if err != nil || !ok {
			t.Fatalf("developer placeholder missing: %v %v", ok, err)
		}
		developerID, err := env.Store.ApplyDeveloper(ctx, contractSource, catalog.DeveloperRecord{ExternalID: "801", Name: "Studio"}, at)
		if err != nil || developerID != placeholder {
			t.Fatalf("developer apply %d %v, want placeholder %d", developerID, err, placeholder)
		}
		characterID, err := env.Store.ApplyCharacter(ctx, contractSource, catalog.CharacterRecord{ExternalID: "701", NameJP: "ヒロイン"}, at)
		if err != nil || characterID == 0 {
			t.Fatalf("character apply %d %v", characterID, err)
		}
		_, related, err = env.Store.ApplyGame(ctx, contractSource, GameRecord("9001", []string{"801", "802"}, []string{"701"}), creator, at)
		if err != nil || !slices.Equal(related, []catalog.Ref{ref(catalog.EntityDeveloper, "802")}) {
			t.Fatalf("only the unsynced developer should remain: %v %v", related, err)
		}
	})

	t.Run("stale returns unsynced then oldest links and skips missing ones", func(t *testing.T) {
		env := newEnv(t)
		creator := env.CreatorID(t)
		if _, _, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("1", nil, nil), creator, at); err != nil {
			t.Fatal(err)
		}
		if _, _, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("2", []string{"50"}, nil), creator, at.Add(time.Hour)); err != nil {
			t.Fatal(err)
		}
		if _, _, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("3", nil, nil), creator, at.Add(3*time.Hour)); err != nil {
			t.Fatal(err)
		}
		refs, err := env.Store.Stale(ctx, contractSource, at.Add(2*time.Hour), 10)
		if err != nil {
			t.Fatal(err)
		}
		want := []catalog.Ref{ref(catalog.EntityDeveloper, "50"), ref(catalog.EntityGame, "1"), ref(catalog.EntityGame, "2")}
		if !slices.Equal(refs, want) {
			t.Fatalf("stale %v, want %v", refs, want)
		}
		limited, err := env.Store.Stale(ctx, contractSource, at.Add(2*time.Hour), 2)
		if err != nil || !slices.Equal(limited, want[:2]) {
			t.Fatalf("limited stale %v %v", limited, err)
		}
		if err := env.Store.MarkMissing(ctx, ref(catalog.EntityGame, "1"), true, at); err != nil {
			t.Fatal(err)
		}
		refs, err = env.Store.Stale(ctx, contractSource, at.Add(2*time.Hour), 10)
		if err != nil || !slices.Equal(refs, []catalog.Ref{ref(catalog.EntityDeveloper, "50"), ref(catalog.EntityGame, "2")}) {
			t.Fatalf("missing links must not be refreshed: %v %v", refs, err)
		}
		other, err := env.Store.Stale(ctx, "elsewhere", at.Add(24*time.Hour), 10)
		if err != nil || len(other) != 0 {
			t.Fatalf("stale is scoped to its source: %v %v", other, err)
		}
	})

	t.Run("a resynced link is no longer missing", func(t *testing.T) {
		env := newEnv(t)
		creator := env.CreatorID(t)
		if _, _, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("5", nil, nil), creator, at); err != nil {
			t.Fatal(err)
		}
		if err := env.Store.MarkMissing(ctx, ref(catalog.EntityGame, "5"), false, at); err != nil {
			t.Fatal(err)
		}
		if err := env.Store.RecordFailure(ctx, ref(catalog.EntityGame, "5"), "boom", at); err != nil {
			t.Fatal(err)
		}
		if _, _, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("5", nil, nil), creator, at.Add(time.Minute)); err != nil {
			t.Fatal(err)
		}
		refs, err := env.Store.Stale(ctx, contractSource, at.Add(time.Hour), 10)
		if err != nil || !slices.Equal(refs, []catalog.Ref{ref(catalog.EntityGame, "5")}) {
			t.Fatalf("resynced link should be refreshable again: %v %v", refs, err)
		}
	})

	t.Run("excluded entries are skipped until included again", func(t *testing.T) {
		env := newEnv(t)
		creator := env.CreatorID(t)
		id, _, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("6", nil, nil), creator, at)
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err := env.Store.ApplyGame(ctx, contractSource, GameRecord("7", nil, nil), creator, at); err != nil {
			t.Fatal(err)
		}
		if err := env.Store.Exclude(ctx, catalog.EntityGame, id, at); err != nil {
			t.Fatal(err)
		}
		if excluded, err := env.Store.Excluded(ctx, ref(catalog.EntityGame, "6")); err != nil || !excluded {
			t.Fatalf("excluded %v %v", excluded, err)
		}
		if excluded, err := env.Store.Excluded(ctx, ref(catalog.EntityGame, "7")); err != nil || excluded {
			t.Fatalf("other entries stay included: %v %v", excluded, err)
		}
		refs, err := env.Store.Stale(ctx, contractSource, at.Add(time.Hour), 10)
		if err != nil || !slices.Equal(refs, []catalog.Ref{ref(catalog.EntityGame, "7")}) {
			t.Fatalf("excluded entries are not refreshed: %v %v", refs, err)
		}
		if err := env.Store.Include(ctx, ref(catalog.EntityGame, "6")); err != nil {
			t.Fatal(err)
		}
		if excluded, err := env.Store.Excluded(ctx, ref(catalog.EntityGame, "6")); err != nil || excluded {
			t.Fatalf("included again: %v %v", excluded, err)
		}
		if excluded, err := env.Store.Excluded(ctx, ref(catalog.EntityGame, "404")); err != nil || excluded {
			t.Fatalf("unknown refs are not excluded: %v %v", excluded, err)
		}
	})

	t.Run("unknown refs are tolerated", func(t *testing.T) {
		env := newEnv(t)
		missing := ref(catalog.EntityGame, "404")
		if err := env.Store.MarkMissing(ctx, missing, true, at); err != nil {
			t.Fatal(err)
		}
		if err := env.Store.RecordFailure(ctx, missing, "boom", at); err != nil {
			t.Fatal(err)
		}
		if _, ok, err := env.Store.LocalID(ctx, missing); err != nil || ok {
			t.Fatalf("unknown ref resolved: %v %v", ok, err)
		}
	})

	t.Run("cursors round trip per source", func(t *testing.T) {
		env := newEnv(t)
		if cursor, err := env.Store.Cursor(ctx, contractSource); err != nil || cursor != "" {
			t.Fatalf("initial cursor %q %v", cursor, err)
		}
		for _, value := range []string{"42", "43"} {
			if err := env.Store.SaveCursor(ctx, contractSource, value); err != nil {
				t.Fatal(err)
			}
			if cursor, err := env.Store.Cursor(ctx, contractSource); err != nil || cursor != value {
				t.Fatalf("cursor %q %v, want %q", cursor, err, value)
			}
		}
		if cursor, err := env.Store.Cursor(ctx, "elsewhere"); err != nil || cursor != "" {
			t.Fatalf("cursors are scoped per source: %q %v", cursor, err)
		}
	})
}
