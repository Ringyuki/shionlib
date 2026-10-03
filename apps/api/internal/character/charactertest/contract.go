package charactertest

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
)

type Env struct {
	Repo character.Repository
	Seed func(t *testing.T, c character.Character) int
	Link func(t *testing.T, characterID int)
}

func ptr[T any](v T) *T {
	return &v
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("get returns every stored field", func(t *testing.T) {
		env := newEnv(t)
		id := env.Seed(t, character.Character{
			NameJP: "春日野 穹", NameZH: ptr("春日野穹"), Aliases: []string{"Sora"},
			IntroJP: "intro", BloodType: ptr("ab"), Height: ptr(150), Cup: ptr("A"), Age: ptr(16),
			Birthday: []int{3, 14}, Gender: []string{"f"}, Image: ptr("characters/sora.webp"), HID: ptr(77),
		})
		got, err := env.Repo.Get(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		if got.ID != id || got.NameJP != "春日野 穹" || got.NameZH == nil || *got.NameZH != "春日野穹" || got.NameEN != nil {
			t.Fatalf("unexpected names %+v", got)
		}
		if got.BloodType == nil || *got.BloodType != "ab" || *got.Height != 150 || *got.Cup != "A" || *got.Age != 16 || got.Weight != nil {
			t.Fatalf("unexpected body metrics %+v", got)
		}
		if len(got.Birthday) != 2 || got.Birthday[0] != 3 || len(got.Gender) != 1 || got.Gender[0] != "f" || len(got.Aliases) != 1 {
			t.Fatalf("unexpected arrays %+v", got)
		}
		if got.HID == nil || *got.HID != 77 || got.Image == nil || *got.Image != "characters/sora.webp" {
			t.Fatalf("unexpected identity %+v", got)
		}
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, character.ErrNotFound) {
			t.Fatalf("missing character: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, character.ErrNotFound) {
			t.Fatalf("lock missing character: %v", err)
		}
	})

	t.Run("list matches names and aliases case-insensitively and pages by id", func(t *testing.T) {
		env := newEnv(t)
		first := env.Seed(t, character.Character{NameJP: "Leaf", Aliases: []string{"Moonlight"}})
		second := env.Seed(t, character.Character{NameJP: "ほのか", NameEN: ptr("Honoka")})
		third := env.Seed(t, character.Character{NameJP: "ほのか２", NameZH: ptr("穗乃果")})

		all, total, err := env.Repo.List(ctx, "", character.Page{Number: 1, Size: 2})
		if err != nil || total != 3 || len(all) != 2 || all[0].ID != first || all[1].ID != second {
			t.Fatalf("unfiltered page: %+v %d %v", all, total, err)
		}
		byAlias, total, err := env.Repo.List(ctx, "moon", character.Page{Number: 1, Size: 10})
		if err != nil || total != 1 || byAlias[0].ID != first {
			t.Fatalf("alias match: %+v %d %v", byAlias, total, err)
		}
		byName, total, err := env.Repo.List(ctx, "HONO", character.Page{Number: 1, Size: 10})
		if err != nil || total != 1 || byName[0].ID != second {
			t.Fatalf("english name match: %+v %d %v", byName, total, err)
		}
		byChinese, _, err := env.Repo.List(ctx, "乃果", character.Page{Number: 1, Size: 10})
		if err != nil || len(byChinese) != 1 || byChinese[0].ID != third {
			t.Fatalf("chinese name match: %+v %v", byChinese, err)
		}
		literal, _, err := env.Repo.List(ctx, "%", character.Page{Number: 1, Size: 10})
		if err != nil || len(literal) != 0 {
			t.Fatalf("wildcards must be matched literally: %+v %v", literal, err)
		}
	})

	t.Run("relations block deletion", func(t *testing.T) {
		env := newEnv(t)
		linked := env.Seed(t, character.Character{NameJP: "linked"})
		free := env.Seed(t, character.Character{NameJP: "free"})
		env.Link(t, linked)
		if has, err := env.Repo.HasRelations(ctx, linked); err != nil || !has {
			t.Fatalf("linked: %v %v", has, err)
		}
		if has, err := env.Repo.HasRelations(ctx, free); err != nil || has {
			t.Fatalf("free: %v %v", has, err)
		}
		if err := env.Repo.Delete(ctx, linked); !errors.Is(err, character.ErrHasRelations) {
			t.Fatalf("delete linked: %v", err)
		}
		if err := env.Repo.Delete(ctx, free); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.Delete(ctx, free); !errors.Is(err, character.ErrNotFound) {
			t.Fatalf("delete twice: %v", err)
		}
	})
}
