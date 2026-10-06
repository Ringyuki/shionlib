package settingtest

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Env struct {
	Repo      setting.Repository
	NewEditor func(t *testing.T) setting.Editor
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("save stores one value per name and overwrites it", func(t *testing.T) {
		env := newEnv(t)
		mustSave(ctx, t, env.Repo, "upload.max_chunks", `10`)
		mustSave(ctx, t, env.Repo, "upload.max_chunks", `20`)
		mustSave(ctx, t, env.Repo, "scan.auto_delete_note", `"自动删除"`)
		got, found, err := env.Repo.Value(ctx, "upload.max_chunks")
		if err != nil || !found || !sameJSON(got.Value, `20`) || got.Updated.IsZero() {
			t.Fatalf("value: %+v %v %v", got, found, err)
		}
		values, err := env.Repo.Values(ctx)
		if err != nil || len(values) != 2 || values[0].Name != "scan.auto_delete_note" || !sameJSON(values[0].Value, `"自动删除"`) || values[1].Name != "upload.max_chunks" {
			t.Fatalf("values: %+v %v", values, err)
		}
	})

	t.Run("missing values are absent and removing them is a no-op", func(t *testing.T) {
		env := newEnv(t)
		if _, found, err := env.Repo.Value(ctx, "user.allow_register"); err != nil || found {
			t.Fatalf("missing value: found=%v err=%v", found, err)
		}
		if err := env.Repo.Remove(ctx, "user.allow_register"); err != nil {
			t.Fatalf("remove missing: %v", err)
		}
		mustSave(ctx, t, env.Repo, "user.allow_register", `false`)
		if err := env.Repo.Remove(ctx, "user.allow_register"); err != nil {
			t.Fatalf("remove: %v", err)
		}
		if _, found, err := env.Repo.Value(ctx, "user.allow_register"); err != nil || found {
			t.Fatalf("removed value: found=%v err=%v", found, err)
		}
	})

	t.Run("changes come back newest first with their editor", func(t *testing.T) {
		env := newEnv(t)
		editor := env.NewEditor(t)
		mustRecord(ctx, t, env.Repo, setting.NewChange{Name: "download.max_conns", Value: json.RawMessage(`4`), EditorID: editor.ID})
		mustRecord(ctx, t, env.Repo, setting.NewChange{Name: "download.max_conns", Previous: json.RawMessage(`4`), Value: json.RawMessage(`6`), EditorID: editor.ID})
		mustRecord(ctx, t, env.Repo, setting.NewChange{Name: "download.max_conns", Previous: json.RawMessage(`6`), EditorID: editor.ID})
		mustRecord(ctx, t, env.Repo, setting.NewChange{Name: "download.expires_in", Value: json.RawMessage(`60`)})
		changes, total, err := env.Repo.Changes(ctx, "download.max_conns", paging.Page{Number: 1, Size: 2})
		if err != nil || total != 3 || len(changes) != 2 {
			t.Fatalf("changes: %+v total=%d err=%v", changes, total, err)
		}
		newest, older := changes[0], changes[1]
		if newest.Value != nil || !sameJSON(newest.Previous, `6`) || newest.Created.IsZero() || newest.ID == 0 {
			t.Fatalf("newest change: %+v", newest)
		}
		if newest.Editor == nil || *newest.Editor != editor {
			t.Fatalf("editor: %+v, want %+v", newest.Editor, editor)
		}
		if !sameJSON(older.Previous, `4`) || !sameJSON(older.Value, `6`) {
			t.Fatalf("older change: %+v", older)
		}
		rest, total, err := env.Repo.Changes(ctx, "download.max_conns", paging.Page{Number: 2, Size: 2})
		if err != nil || total != 3 || len(rest) != 1 || !sameJSON(rest[0].Value, `4`) || rest[0].Previous != nil {
			t.Fatalf("second page: %+v total=%d err=%v", rest, total, err)
		}
		latest, err := env.Repo.LatestChanges(ctx)
		if err != nil || len(latest) != 2 {
			t.Fatalf("latest: %+v %v", latest, err)
		}
		byName := map[string]setting.Change{}
		for _, change := range latest {
			byName[change.Name] = change
		}
		if conns := byName["download.max_conns"]; conns.Value != nil || !sameJSON(conns.Previous, `6`) {
			t.Fatalf("latest max_conns change: %+v", conns)
		}
		if expires := byName["download.expires_in"]; !sameJSON(expires.Value, `60`) || expires.Editor != nil {
			t.Fatalf("a change without an editor keeps none: %+v", expires)
		}
	})
}

func mustSave(ctx context.Context, t *testing.T, repo setting.Repository, name, value string) {
	t.Helper()
	if err := repo.Save(ctx, name, json.RawMessage(value)); err != nil {
		t.Fatalf("save %s: %v", name, err)
	}
}

func mustRecord(ctx context.Context, t *testing.T, repo setting.Repository, change setting.NewChange) {
	t.Helper()
	if err := repo.Record(ctx, change); err != nil {
		t.Fatalf("record %s: %v", change.Name, err)
	}
}

func sameJSON(raw json.RawMessage, want string) bool {
	var got, expected bytes.Buffer
	if json.Compact(&got, raw) != nil || json.Compact(&expected, []byte(want)) != nil {
		return false
	}
	return bytes.Equal(got.Bytes(), expected.Bytes())
}
