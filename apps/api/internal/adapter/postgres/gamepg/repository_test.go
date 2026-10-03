package gamepg_test

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamerelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type fixtures struct {
	t   *testing.T
	db  *pgtest.DB
	ctx context.Context
}

func newFixtures(t *testing.T) fixtures {
	return fixtures{t: t, db: pgtest.New(t), ctx: context.Background()}
}

func (f fixtures) game(mutate ...func(*ent.GameCreate)) int {
	f.t.Helper()
	return f.db.Game(f.t, mutate...)
}

func (f fixtures) cover(gameID, sexual int) {
	f.t.Helper()
	if err := f.db.Ent.GameCover.Create().SetGameID(gameID).SetLanguage("jp").SetType("pkgfront").SetURL("c.webp").SetDims(pgvalue.Ints{1, 2}).SetSexual(sexual).SetViolence(0).Exec(f.ctx); err != nil {
		f.t.Fatal(err)
	}
}

func (f fixtures) resource(gameID, status int) {
	f.t.Helper()
	if err := f.db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(f.db.User(f.t)).SetStatus(status).Exec(f.ctx); err != nil {
		f.t.Fatal(err)
	}
}

func (f fixtures) tag(name string, count int, gameIDs ...int) int {
	f.t.Helper()
	row, err := f.db.Ent.Tag.Create().SetName(name).SetCount(count).SetAliases(pgvalue.Strings{name + "-alias"}).Save(f.ctx)
	if err != nil {
		f.t.Fatal(err)
	}
	for _, id := range gameIDs {
		if err := f.db.Ent.GameTagRelation.Create().SetGameID(id).SetTagID(row.ID).Exec(f.ctx); err != nil {
			f.t.Fatal(err)
		}
	}
	return row.ID
}

func (f fixtures) developer(name string) int {
	f.t.Helper()
	row, err := f.db.Ent.GameDeveloper.Create().SetName(name).SetAliases(pgvalue.Strings{name + " alias"}).Save(f.ctx)
	if err != nil {
		f.t.Fatal(err)
	}
	return row.ID
}

func (f fixtures) credit(gameID, developerID int, role string) {
	f.t.Helper()
	if err := f.db.Ent.GameDeveloperRelation.Create().SetGameID(gameID).SetDeveloperID(developerID).SetRole(role).Exec(f.ctx); err != nil {
		f.t.Fatal(err)
	}
}

func ids(t *testing.T, got []int, err error) []int {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func date(year int, month time.Month) func(*ent.GameCreate) {
	return func(c *ent.GameCreate) { c.SetReleaseDate(time.Date(year, month, 10, 0, 0, 0, 0, time.UTC)) }
}

func TestListFiltersAndOrders(t *testing.T) {
	f := newFixtures(t)
	repo := gamepg.NewRepository(f.db.Ent)
	old := f.game(date(2020, time.March), func(c *ent.GameCreate) { c.SetViews(5).SetPlatform(pgvalue.Strings{"win"}) })
	recent := f.game(date(2024, time.July), func(c *ent.GameCreate) { c.SetViews(1).SetPlatform(pgvalue.Strings{"ios", "and"}) })
	undated := f.game(func(c *ent.GameCreate) { c.SetViews(9) })
	rated := f.game(date(2023, time.January))
	nsfw := f.game(date(2022, time.January), func(c *ent.GameCreate) { c.SetNsfw(true) })
	hidden := f.game(date(2025, time.January), func(c *ent.GameCreate) { c.SetStatus(2) })
	f.cover(rated, 2)
	f.cover(old, 0)
	f.resource(old, 1)
	f.resource(recent, 2)
	f.tag("School", 3, old, rated)
	f.tag("Fantasy", 1, recent)
	dev := f.developer("Yuzu")
	f.credit(recent, dev, "发行")

	page := game.Page{Number: 1, Size: 10}
	all := game.ListFilter{SortBy: game.SortByReleaseDate, SortOrder: game.SortDescending}
	got, total, err := repo.List(f.ctx, all, page)
	if err != nil || total != 5 || !slices.Equal(got, []int{recent, rated, nsfw, old, undated}) {
		t.Fatalf("release order with nulls last: %v %d %v (hidden %d)", got, total, err, hidden)
	}
	asc := all
	asc.SortOrder = game.SortAscending
	if got, _, _ := repo.List(f.ctx, asc, page); !slices.Equal(got, []int{old, nsfw, rated, recent, undated}) {
		t.Fatalf("ascending release order: %v", got)
	}
	strict := all
	strict.ExcludeRated = true
	if got, _, _ := repo.List(f.ctx, strict, page); !slices.Equal(got, []int{recent, old, undated}) {
		t.Fatalf("strict viewers: %v", got)
	}
	withResources := all
	withResources.OnlyWithResources = true
	if got, _, _ := repo.List(f.ctx, withResources, page); !slices.Equal(got, []int{old}) {
		t.Fatalf("only games with approved resources: %v", got)
	}
	byViews := game.ListFilter{SortBy: game.SortByViews, SortOrder: game.SortDescending}
	if got, _, _ := repo.List(f.ctx, byViews, game.Page{Number: 1, Size: 2}); !slices.Equal(got, []int{undated, old}) {
		t.Fatalf("views order: %v", got)
	}

	filtered := func(mutate func(*game.ListFilter)) []int {
		filter := all
		mutate(&filter)
		got, _, err := repo.List(f.ctx, filter, page)
		return ids(t, got, err)
	}
	if got := filtered(func(l *game.ListFilter) { l.Tags = []string{"school", "fantasy"} }); !slices.Equal(got, []int{recent, rated, old}) {
		t.Fatalf("tags match any name case-insensitively: %v", got)
	}
	if got := filtered(func(l *game.ListFilter) { l.ExcludeTags = []string{"SCHOOL"} }); !slices.Equal(got, []int{recent, nsfw, undated}) {
		t.Fatalf("excluded tags: %v", got)
	}
	if got := filtered(func(l *game.ListFilter) { l.Platforms = []string{"and", "mac"} }); !slices.Equal(got, []int{recent}) {
		t.Fatalf("platform overlap: %v", got)
	}
	if got := filtered(func(l *game.ListFilter) { l.ReleasePeriods = []string{"2020-03", "2024"} }); !slices.Equal(got, []int{recent, old}) {
		t.Fatalf("release periods: %v", got)
	}
	after, before := time.Date(2022, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC)
	if got := filtered(func(l *game.ListFilter) { l.ReleasedAfter, l.ReleasedBefore = &after, &before }); !slices.Equal(got, []int{rated, nsfw}) {
		t.Fatalf("release window: %v", got)
	}
	if got := filtered(func(l *game.ListFilter) { l.DeveloperID = &dev }); !slices.Equal(got, []int{recent}) {
		t.Fatalf("developer filter matches any role: %v", got)
	}

	listable, err := repo.Listable(f.ctx, []int{hidden, rated, old, 999999}, game.Visibility{ExcludeRated: true})
	if err != nil || !slices.Equal(listable, []int{old}) {
		t.Fatalf("listable: %v %v", listable, err)
	}
	if count, err := repo.CountListable(f.ctx, game.Visibility{ExcludeRated: true}); err != nil || count != 3 {
		t.Fatalf("count listable: %d %v", count, err)
	}
	if id, ok, err := repo.ListableAt(f.ctx, game.Visibility{ExcludeRated: true}, 2); err != nil || !ok || id != undated {
		t.Fatalf("listable at: %d %v %v", id, ok, err)
	}
	if _, ok, err := repo.ListableAt(f.ctx, game.Visibility{}, 99); err != nil || ok {
		t.Fatalf("offset beyond the end: %v %v", ok, err)
	}
}

func TestDetailLoadsTheWholeCatalogEntry(t *testing.T) {
	f := newFixtures(t)
	repo := gamepg.NewRepository(f.db.Ent)
	extra, _ := json.Marshal([]map[string]any{{"key": "官网", "value": "https://example.test"}, {"key": "年份", "value": 2020}})
	staffs, _ := json.Marshal([]map[string]string{{"name": "Writer", "role": "剧本"}})
	id := f.game(date(2021, time.May), func(c *ent.GameCreate) {
		c.SetTitleJp("タイトル").SetTitleZh("标题").SetAliases(pgvalue.Strings{"alias"}).SetIntroZh("简介").SetVID("v17").SetBID("42").SetHID(9).
			SetType("adv").SetPlatform(pgvalue.Strings{"win"}).SetExtraInfo(extra).SetStaffs(staffs).SetReleaseDateTba(true)
	})
	f.cover(id, 0)
	if err := f.db.Ent.GameImage.Create().SetGameID(id).SetURL("i.webp").SetDims(pgvalue.Ints{3, 4}).SetSexual(1).SetViolence(2).Exec(f.ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.db.Ent.GameLink.Create().SetGameID(id).SetName("official").SetLabel("Official").SetURL("https://example.test").Exec(f.ctx); err != nil {
		t.Fatal(err)
	}
	dev, publisher := f.developer("Yuzu"), f.developer("Publisher")
	f.credit(id, dev, "开发")
	f.credit(id, publisher, "发行")
	low := f.tag("low", 1, id)
	high := f.tag("high", 5, id)
	sora, err := f.db.Ent.GameCharacter.Create().SetNameJp("穹").SetImage("characters/sora.webp").SetBloodType(gamecharacter.BloodTypeAb).SetGender(pgvalue.Strings{"f"}).SetBirthday(pgvalue.Ints{3, 14}).Save(f.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.db.Ent.GameCharacterRelation.Create().SetGameID(id).SetCharacterID(sora.ID).SetRole(gamecharacterrelation.RoleMain).SetActor("CV").Exec(f.ctx); err != nil {
		t.Fatal(err)
	}

	detail, err := repo.Detail(f.ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if detail.TitleJP != "タイトル" || detail.TitleZH != "标题" || *detail.VID != "v17" || *detail.BID != "42" || *detail.HID != 9 || !detail.ReleaseDateTBA || *detail.Type != "adv" || detail.Platforms[0] != "win" {
		t.Fatalf("unexpected scalars %+v", detail)
	}
	if len(detail.ExtraInfo) != 2 || detail.ExtraInfo[1] != (game.ExtraInfo{Key: "年份", Value: "2020"}) || len(detail.Staffs) != 1 || detail.Staffs[0].Role != "剧本" {
		t.Fatalf("unexpected json columns %+v %+v", detail.ExtraInfo, detail.Staffs)
	}
	if len(detail.Covers) != 1 || len(detail.Images) != 1 || detail.Images[0].Violence != 2 || detail.Images[0].Dims[1] != 4 || len(detail.Links) != 1 || detail.Links[0].Label != "Official" {
		t.Fatalf("unexpected media %+v %+v %+v", detail.Covers, detail.Images, detail.Links)
	}
	if len(detail.Developers) != 1 || detail.Developers[0].Developer.ID != dev || detail.Developers[0].Role != "开发" {
		t.Fatalf("only developer credits are listed: %+v", detail.Developers)
	}
	if len(detail.Tags) != 2 || detail.Tags[0].Tag.ID != high || detail.Tags[1].Tag.ID != low || detail.Tags[0].Tag.Aliases[0] != "high-alias" {
		t.Fatalf("tags by count: %+v", detail.Tags)
	}
	if len(detail.Characters) != 1 || detail.Characters[0].Role != "main" || *detail.Characters[0].Actor != "CV" || *detail.Characters[0].Image != "characters/sora.webp" || *detail.Characters[0].Character.BloodType != "ab" {
		t.Fatalf("characters: %+v", detail.Characters)
	}

	hidden := f.game(func(c *ent.GameCreate) { c.SetStatus(2) })
	if _, err := repo.Detail(f.ctx, hidden); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("hidden: %v", err)
	}
	if ext, err := repo.ExternalIDs(f.ctx, hidden); err != nil || ext.BangumiID != nil {
		t.Fatalf("external ids ignore status: %+v %v", ext, err)
	}
	if ext, err := repo.ExternalIDs(f.ctx, id); err != nil || *ext.BangumiID != "42" || *ext.VNDBID != "v17" {
		t.Fatalf("external ids: %+v %v", ext, err)
	}
	if _, err := repo.ExternalIDs(f.ctx, 999999); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
}

func TestRelationsViewsAndPreferences(t *testing.T) {
	f := newFixtures(t)
	repo := gamepg.NewRepository(f.db.Ent)
	from, safe, rated, hidden := f.game(), f.game(), f.game(), f.game(func(c *ent.GameCreate) { c.SetStatus(2) })
	f.cover(rated, 1)
	for _, target := range []int{safe, rated, hidden} {
		if err := f.db.Ent.GameRelation.Create().SetFromGameID(from).SetToGameID(target).SetRelation(gamerelation.RelationSEQUEL).Exec(f.ctx); err != nil {
			t.Fatal(err)
		}
	}
	relations, err := repo.Relations(f.ctx, from)
	if err != nil || len(relations) != 2 {
		t.Fatalf("relations: %+v %v", relations, err)
	}
	if relations[0].ToGameID != safe || relations[0].TargetRated || relations[0].Kind != "SEQUEL" || relations[1].ToGameID != rated || !relations[1].TargetRated {
		t.Fatalf("unexpected relations %+v", relations)
	}

	if err := repo.IncreaseViews(f.ctx, from); err != nil {
		t.Fatal(err)
	}
	if row, _ := f.db.Ent.Game.Get(f.ctx, from); row.Views != 1 {
		t.Fatalf("views: %d", row.Views)
	}
	if err := repo.IncreaseViews(f.ctx, 999999); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}

	prefs := gamepg.NewPreferences(f.db.Ent)
	user := f.db.User(t)
	if only, err := prefs.OnlyGamesWithResources(f.ctx, user); err != nil || !only {
		t.Fatalf("default: %v %v", only, err)
	}
	if err := f.db.Ent.User.UpdateOneID(user).SetOnlyGamesWithResources(false).Exec(f.ctx); err != nil {
		t.Fatal(err)
	}
	if only, err := prefs.OnlyGamesWithResources(f.ctx, user); err != nil || only {
		t.Fatalf("disabled: %v %v", only, err)
	}
	if only, err := prefs.OnlyGamesWithResources(f.ctx, 999999); err != nil || !only {
		t.Fatalf("unknown users default to on: %v %v", only, err)
	}
}

func TestRefreshHotScoreUsesTheLegacyFormula(t *testing.T) {
	f := newFixtures(t)
	repo := gamepg.NewRepository(f.db.Ent)
	popular := f.game(func(c *ent.GameCreate) { c.SetViews(100).SetDownloads(10) })
	future := f.game(func(c *ent.GameCreate) { c.SetReleaseDate(time.Now().Add(240 * time.Hour)).SetHotScore(7) })
	weights := game.HotScoreWeights{HalfLifeReleaseDays: 30, HalfLifeCreatedDays: 15, Views: 0.6, Downloads: 1, Release: 0.8, Created: 0.4, RecentWindowDays: 7, RecentViews: 0.6, RecentDownloads: 0.9}
	affected, err := repo.RefreshHotScore(f.ctx, weights)
	if err != nil || affected < 1 {
		t.Fatalf("refresh: %d %v", affected, err)
	}
	row, _ := f.db.Ent.Game.Get(f.ctx, popular)
	if want := 0.6*math.Log(101) + math.Log(11) + 0.6*math.Log(701) + 0.9*math.Log(71) + 0.8 + 0.4*math.Exp(-1.0/15); math.Abs(row.HotScore-want) > 0.01 {
		t.Fatalf("unexpected score %f", row.HotScore)
	}
	if untouched, _ := f.db.Ent.Game.Get(f.ctx, future); untouched.HotScore != 7 {
		t.Fatalf("future releases keep their score: %f", untouched.HotScore)
	}
	if again, err := repo.RefreshHotScore(f.ctx, weights); err != nil || again > affected {
		t.Fatalf("second refresh only touches changed rows: %d %v", again, err)
	}
}
