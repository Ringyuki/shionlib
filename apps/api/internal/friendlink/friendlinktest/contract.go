package friendlinktest

import (
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

type Env struct {
	Repo friendlink.Repository
}

func names(links []friendlink.Link, ids ...int) []string {
	out := []string{}
	for _, link := range links {
		if slices.Contains(ids, link.ID) {
			out = append(out, link.Name)
		}
	}
	return out
}

func base(t *testing.T, repo friendlink.Repository) int {
	t.Helper()
	last, err := repo.LastPosition(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	return last + 100
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	t.Run("missing rows are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(t.Context(), 987654); !errors.Is(err, friendlink.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
		if _, err := env.Repo.Update(t.Context(), 987654, friendlink.Changes{}); !errors.Is(err, friendlink.ErrNotFound) {
			t.Fatalf("update: %v", err)
		}
		if err := env.Repo.Delete(t.Context(), 987654); !errors.Is(err, friendlink.ErrNotFound) {
			t.Fatalf("delete: %v", err)
		}
	})

	t.Run("links are listed by position and hidden ones only when asked", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		at := base(t, env.Repo)
		logo := "friend-link/logo/a.webp"
		b, err := env.Repo.Create(ctx, friendlink.NewLink{Name: "B", URL: "https://b.example", Visible: false}, at+2)
		if err != nil {
			t.Fatal(err)
		}
		a, err := env.Repo.Create(ctx, friendlink.NewLink{Name: "A", URL: "https://a.example", Logo: &logo, Description: "a", Visible: true}, at+1)
		if err != nil {
			t.Fatal(err)
		}
		c, err := env.Repo.Create(ctx, friendlink.NewLink{Name: "C", URL: "https://c.example", Visible: true}, at+3)
		if err != nil {
			t.Fatal(err)
		}
		all, err := env.Repo.List(ctx, false)
		if got := names(all, a.ID, b.ID, c.ID); err != nil || !slices.Equal(got, []string{"A", "B", "C"}) {
			t.Fatalf("every link in order: %v %v", got, err)
		}
		got, err := env.Repo.Get(ctx, a.ID)
		if err != nil || got.Logo == nil || *got.Logo != logo || got.Description != "a" || got.Position != at+1 {
			t.Fatalf("fields are kept: %+v %v", got, err)
		}
		visible, err := env.Repo.List(ctx, true)
		if got := names(visible, a.ID, b.ID, c.ID); err != nil || !slices.Equal(got, []string{"A", "C"}) {
			t.Fatalf("visible links only: %v %v", got, err)
		}
		if last, err := env.Repo.LastPosition(ctx); err != nil || last != at+3 {
			t.Fatalf("last position: %d %v", last, err)
		}
	})

	t.Run("positions can be set", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		at := base(t, env.Repo)
		a, _ := env.Repo.Create(ctx, friendlink.NewLink{Name: "A", URL: "https://a.example"}, at+1)
		b, _ := env.Repo.Create(ctx, friendlink.NewLink{Name: "B", URL: "https://b.example"}, at+5)
		c, _ := env.Repo.Create(ctx, friendlink.NewLink{Name: "C", URL: "https://c.example"}, at+9)
		if err := env.Repo.SetPosition(ctx, c.ID, at); err != nil {
			t.Fatal(err)
		}
		all, _ := env.Repo.List(ctx, false)
		if got := names(all, a.ID, b.ID, c.ID); !slices.Equal(got, []string{"C", "A", "B"}) {
			t.Fatalf("C moves first: %v", got)
		}
		if err := env.Repo.SetPosition(ctx, 987654, 1); !errors.Is(err, friendlink.ErrNotFound) {
			t.Fatalf("set position of a missing link: %v", err)
		}
	})

	t.Run("updates change only what they name and can clear the logo", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		logo := "friend-link/logo/a.webp"
		created, _ := env.Repo.Create(ctx, friendlink.NewLink{Name: "A", URL: "https://a.example", Logo: &logo, Description: "old", Visible: true}, 1)
		description, hidden := "new", false
		updated, err := env.Repo.Update(ctx, created.ID, friendlink.Changes{Description: &description, Visible: &hidden})
		if err != nil || updated.Name != "A" || updated.Description != "new" || updated.Visible || updated.Logo == nil {
			t.Fatalf("partial update: %+v %v", updated, err)
		}
		cleared, err := env.Repo.Update(ctx, created.ID, friendlink.Changes{Logo: patch.Clearable[string]{Set: true}})
		if err != nil || cleared.Logo != nil {
			t.Fatalf("logo cleared: %+v %v", cleared, err)
		}
		if err := env.Repo.Delete(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Get(ctx, created.ID); !errors.Is(err, friendlink.ErrNotFound) {
			t.Fatalf("deleted: %v", err)
		}
	})
}
