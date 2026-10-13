package translatortest

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type Env struct {
	Repo     translator.Repository
	Store    translator.AdminStore
	Seed     func(t *testing.T, item translator.Translator) int
	NewGame  func(t *testing.T) int
	Credit   func(t *testing.T, gameID int, visible bool, at time.Time, translatorIDs ...int) int
	Credited func(t *testing.T, resourceID int) []int
}

func ptr[T any](v T) *T {
	return &v
}

func names(items []translator.Summary) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = item.Name
	}
	return out
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	day := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)

	t.Run("missing rows are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, translator.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, translator.ErrNotFound) {
			t.Fatalf("lock: %v", err)
		}
		if err := env.Repo.Update(ctx, 987654, translator.Changes{Name: ptr("x")}); !errors.Is(err, translator.ErrNotFound) {
			t.Fatalf("update: %v", err)
		}
		if err := env.Repo.Delete(ctx, 987654); !errors.Is(err, translator.ErrNotFound) {
			t.Fatalf("delete: %v", err)
		}
	})

	t.Run("ensure creates a name once whatever its width or case", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		creator := 7
		first, err := env.Repo.Ensure(ctx, translator.NewTranslator{Name: "Can/need汉化组", CreatorID: &creator})
		if err != nil {
			t.Fatal(err)
		}
		if first.ID == 0 || first.Name != "Can/need汉化组" || first.CreatorID == nil || *first.CreatorID != creator || len(first.Aliases) != 0 {
			t.Fatalf("created %+v", first)
		}
		again, err := env.Repo.Ensure(ctx, translator.NewTranslator{Name: "Can／Need汉化组"})
		if err != nil || again.ID != first.ID || again.Name != "Can/need汉化组" {
			t.Fatalf("same key must return the stored row: %+v %v", again, err)
		}
		stored, err := env.Repo.Get(ctx, first.ID)
		if err != nil || stored.Name != first.Name {
			t.Fatalf("get %+v %v", stored, err)
		}
	})

	t.Run("names and aliases are found by key", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		mokushi := env.Seed(t, translator.Translator{Name: "默示游戏中文化兴趣小组", Aliases: []string{"黙示游戏中文化兴趣小组", "默示汉化组"}})
		tea := env.Seed(t, translator.Translator{Name: "绿茶汉化组"})
		found, err := env.Repo.FindByKeys(ctx, []string{translator.Key("默示汉化组"), translator.Key("绿茶汉化组"), translator.Key("无人知晓")})
		if err != nil || len(found) != 2 || found[0].ID != mokushi || found[1].ID != tea {
			t.Fatalf("find %+v %v", found, err)
		}
		if none, err := env.Repo.FindByKeys(ctx, nil); err != nil || len(none) != 0 {
			t.Fatalf("no keys %+v %v", none, err)
		}
	})

	t.Run("update renames, replaces aliases and sets or clears the homepage", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		id := env.Seed(t, translator.Translator{Name: "Pro2汉化组"})
		other := env.Seed(t, translator.Translator{Name: "脸肿汉化组"})
		aliases := []string{"PRO2", "Pro2"}
		if err := env.Repo.Update(ctx, id, translator.Changes{Name: ptr("PRO2汉化组"), Aliases: &aliases, Homepage: patch.Clearable[string]{Set: true, Value: ptr("https://pro2.example")}}); err != nil {
			t.Fatal(err)
		}
		stored, err := env.Repo.Get(ctx, id)
		if err != nil || stored.Name != "PRO2汉化组" || !slices.Equal(stored.Aliases, aliases) || stored.Homepage == nil || *stored.Homepage != "https://pro2.example" {
			t.Fatalf("stored %+v %v", stored, err)
		}
		if found, err := env.Repo.FindByKeys(ctx, []string{translator.Key("pro2")}); err != nil || len(found) != 1 || found[0].ID != id {
			t.Fatalf("alias keys follow the aliases: %+v %v", found, err)
		}
		if err := env.Repo.Update(ctx, id, translator.Changes{Homepage: patch.Clearable[string]{Set: true}}); err != nil {
			t.Fatal(err)
		}
		if stored, _ = env.Repo.Get(ctx, id); stored.Homepage != nil || stored.Name != "PRO2汉化组" {
			t.Fatalf("cleared %+v", stored)
		}
		if err := env.Repo.Update(ctx, other, translator.Changes{Name: ptr("pro2汉化组")}); !errors.Is(err, translator.ErrNameTaken) {
			t.Fatalf("taken name: %v", err)
		}
	})

	t.Run("the list holds translators with visible works, most works first", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		tea := env.Seed(t, translator.Translator{Name: "绿茶汉化组", Aliases: []string{"Green Tea"}})
		panda := env.Seed(t, translator.Translator{Name: "熊喵守护协会"})
		hidden := env.Seed(t, translator.Translator{Name: "尚未发布汉化组"})
		idle := env.Seed(t, translator.Translator{Name: "绿洲汉化组"})
		first, second := env.NewGame(t), env.NewGame(t)
		env.Credit(t, first, true, day, tea, panda)
		env.Credit(t, first, true, day.Add(time.Hour), tea)
		env.Credit(t, second, true, day.Add(2*time.Hour), tea)
		env.Credit(t, second, false, day.Add(3*time.Hour), hidden)

		items, total, err := env.Repo.List(ctx, "", translator.Page{Number: 1, Size: 10})
		if err != nil || total != 2 || !slices.Equal(names(items), []string{"绿茶汉化组", "熊喵守护协会"}) || items[0].WorksCount != 2 || items[1].WorksCount != 1 {
			t.Fatalf("list %+v %d %v", items, total, err)
		}
		if items[0].ID != tea || !slices.Equal(items[0].Aliases, []string{"Green Tea"}) {
			t.Fatalf("summary %+v", items[0])
		}
		paged, total, err := env.Repo.List(ctx, "", translator.Page{Number: 2, Size: 1})
		if err != nil || total != 2 || len(paged) != 1 || paged[0].ID != panda {
			t.Fatalf("second page %+v %d %v", paged, total, err)
		}
		byAlias, total, err := env.Repo.List(ctx, "green", translator.Page{Number: 1, Size: 10})
		if err != nil || total != 1 || byAlias[0].ID != tea {
			t.Fatalf("alias search %+v %d %v", byAlias, total, err)
		}
		suggested, err := env.Repo.Suggest(ctx, "绿", 8)
		if err != nil || !slices.Equal(names(suggested), []string{"绿茶汉化组", "绿洲汉化组"}) || suggested[1].ID != idle || suggested[1].WorksCount != 0 {
			t.Fatalf("suggestions include translators without works: %+v %v", suggested, err)
		}
		if limited, err := env.Repo.Suggest(ctx, "汉化组", 2); err != nil || len(limited) != 2 {
			t.Fatalf("limit %+v %v", limited, err)
		}
		if works, err := env.Repo.CountWorks(ctx, tea); err != nil || works != 2 {
			t.Fatalf("works %d %v", works, err)
		}
		if works, err := env.Repo.CountWorks(ctx, hidden); err != nil || works != 0 {
			t.Fatalf("unpublished works %d %v", works, err)
		}
	})

	t.Run("reassign moves credits and keeps one per resource", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		kept := env.Seed(t, translator.Translator{Name: "破琵琶生产公社汉化组"})
		merged := env.Seed(t, translator.Translator{Name: "破琵琶生产公社"})
		game := env.NewGame(t)
		both := env.Credit(t, game, true, day, kept, merged)
		only := env.Credit(t, env.NewGame(t), true, day, merged)
		if err := env.Repo.Reassign(ctx, merged, kept); err != nil {
			t.Fatal(err)
		}
		if got := env.Credited(t, both); !slices.Equal(got, []int{kept}) {
			t.Fatalf("shared resource keeps one credit: %v", got)
		}
		if got := env.Credited(t, only); !slices.Equal(got, []int{kept}) {
			t.Fatalf("moved credit: %v", got)
		}
		if err := env.Repo.Delete(ctx, merged); err != nil {
			t.Fatal(err)
		}
		if works, err := env.Repo.CountWorks(ctx, kept); err != nil || works != 2 {
			t.Fatalf("works after merge %d %v", works, err)
		}
	})

	t.Run("the admin store counts, sorts, scans and remembers distinctions", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		tea := env.Seed(t, translator.Translator{Name: "绿茶汉化组", Homepage: ptr("https://tea.example")})
		panda := env.Seed(t, translator.Translator{Name: "熊喵守护协会", Aliases: []string{"熊喵"}})
		idle := env.Seed(t, translator.Translator{Name: "闲置汉化组"})
		game := env.NewGame(t)
		env.Credit(t, game, true, day, tea)
		env.Credit(t, game, false, day.Add(48*time.Hour), tea)
		env.Credit(t, env.NewGame(t), true, day.Add(24*time.Hour), panda)

		entries, total, err := env.Store.Search(ctx, translator.AdminFilter{SortBy: translator.SortByResources, Descending: true}, translator.Page{Number: 1, Size: 10})
		if err != nil || total != 3 || len(entries) != 3 || entries[0].ID != tea || entries[1].ID != panda || entries[2].ID != idle {
			t.Fatalf("search %+v %d %v", entries, total, err)
		}
		if entries[0].WorksCount != 1 || entries[0].ResourcesCount != 2 || entries[0].LatestCredit == nil || !entries[0].LatestCredit.Equal(day.Add(48*time.Hour)) || entries[0].Homepage == nil {
			t.Fatalf("counts %+v", entries[0])
		}
		if entries[2].ResourcesCount != 0 || entries[2].LatestCredit != nil {
			t.Fatalf("idle %+v", entries[2])
		}
		latest, _, err := env.Store.Search(ctx, translator.AdminFilter{SortBy: translator.SortByLatest, Descending: true}, translator.Page{Number: 1, Size: 1})
		if err != nil || len(latest) != 1 || latest[0].ID != tea {
			t.Fatalf("latest %+v %v", latest, err)
		}
		searched, total, err := env.Store.Search(ctx, translator.AdminFilter{Search: "熊喵", SortBy: translator.SortByName}, translator.Page{Number: 1, Size: 10})
		if err != nil || total != 1 || searched[0].ID != panda || !slices.Equal(searched[0].Aliases, []string{"熊喵"}) {
			t.Fatalf("search by name %+v %d %v", searched, total, err)
		}
		scanned, err := env.Store.Scan(ctx, 2)
		if err != nil || len(scanned) != 2 || scanned[0].ID != tea || scanned[0].ResourcesCount != 2 {
			t.Fatalf("scan %+v %v", scanned, err)
		}
		pair := translator.Distinction{LowID: tea, HighID: panda}
		if err := env.Store.AddDistinctions(ctx, []translator.Distinction{pair, pair}); err != nil {
			t.Fatal(err)
		}
		if err := env.Store.AddDistinctions(ctx, []translator.Distinction{pair}); err != nil {
			t.Fatalf("a distinction is kept once: %v", err)
		}
		if stored, err := env.Store.Distinctions(ctx); err != nil || !slices.Equal(stored, []translator.Distinction{pair}) {
			t.Fatalf("distinctions %+v %v", stored, err)
		}
	})
}
