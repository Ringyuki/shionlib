package potatovntest

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

type TagFixture struct {
	Name  string
	Alias *string
}

type CoverFixture struct {
	URL      string
	Sexual   int
	Violence int
}

type GameFixture struct {
	VNDBID      *string
	BangumiID   *string
	TitleJP     string
	TitleZH     string
	IntroZH     string
	ReleaseDate *time.Time
	Tags        []TagFixture
	Covers      []CoverFixture
}

type Env struct {
	Repo    potatovn.Repository
	Catalog potatovn.Catalog
	NewUser func(t *testing.T) int
	NewGame func(t *testing.T, fixture GameFixture) int
}

func ptr[T any](v T) *T {
	return &v
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	expires := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)

	t.Run("bindings are unique per user and keep the token private to the store", func(t *testing.T) {
		env := newEnv(t)
		member := env.NewUser(t)
		if _, err := env.Repo.Binding(ctx, member); !errors.Is(err, potatovn.ErrBindingNotFound) {
			t.Fatalf("missing binding: %v", err)
		}
		created, err := env.Repo.CreateBinding(ctx, potatovn.NewBinding{UserID: member, PVNUserID: 77, PVNUserName: "pvn", Token: "t1", TokenExpires: expires})
		if err != nil {
			t.Fatal(err)
		}
		if created.UserID != member || created.PVNUserID != 77 || created.PVNUserName != "pvn" || created.PVNUserAvatar != nil || !created.TokenExpires.Equal(expires) || created.Created.IsZero() {
			t.Fatalf("unexpected binding %+v", created)
		}
		if _, err := env.Repo.CreateBinding(ctx, potatovn.NewBinding{UserID: member, PVNUserID: 1, PVNUserName: "x", Token: "t", TokenExpires: expires}); !errors.Is(err, potatovn.ErrBindingAlreadyExists) {
			t.Fatalf("duplicate binding: %v", err)
		}
		later := expires.Add(time.Hour)
		if err := env.Repo.UpdateToken(ctx, member, "t2", later); err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Binding(ctx, member)
		if got.Token != "t2" || !got.TokenExpires.Equal(later) {
			t.Fatalf("token not updated %+v", got)
		}
		if err := env.Repo.UpdateToken(ctx, env.NewUser(t), "x", later); !errors.Is(err, potatovn.ErrBindingNotFound) {
			t.Fatalf("update missing binding: %v", err)
		}
		if err := env.Repo.DeleteBinding(ctx, member); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.DeleteBinding(ctx, member); !errors.Is(err, potatovn.ErrBindingNotFound) {
			t.Fatalf("delete missing binding: %v", err)
		}
	})

	t.Run("binding listings for scheduled work", func(t *testing.T) {
		env := newEnv(t)
		now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
		soon, later, expired := env.NewUser(t), env.NewUser(t), env.NewUser(t)
		for userID, at := range map[int]time.Time{soon: now.Add(24 * time.Hour), later: now.Add(30 * 24 * time.Hour), expired: now.Add(-time.Hour)} {
			if _, err := env.Repo.CreateBinding(ctx, potatovn.NewBinding{UserID: userID, PVNUserID: userID, PVNUserName: "u", Token: "t", TokenExpires: at}); err != nil {
				t.Fatal(err)
			}
		}
		expiring, err := env.Repo.BindingsExpiringBefore(ctx, now.Add(3*24*time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		slices.Sort(expiring)
		want := []int{soon, expired}
		slices.Sort(want)
		if !slices.Equal(expiring, want) {
			t.Fatalf("expiring bindings: got %v want %v", expiring, want)
		}
		all := []int{soon, later, expired}
		slices.Sort(all)
		first, err := env.Repo.BindingUserIDs(ctx, 0, 2)
		if err != nil || !slices.Equal(first, all[:2]) {
			t.Fatalf("first batch %v %v", first, err)
		}
		rest, _ := env.Repo.BindingUserIDs(ctx, first[1], 2)
		if !slices.Equal(rest, all[2:]) {
			t.Fatalf("second batch %v", rest)
		}
	})

	t.Run("expired bindings are removed with their mappings", func(t *testing.T) {
		env := newEnv(t)
		now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
		stale, fresh := env.NewUser(t), env.NewUser(t)
		gameID := env.NewGame(t, GameFixture{TitleJP: "g"})
		for userID, at := range map[int]time.Time{stale: now.Add(-time.Minute), fresh: now.Add(time.Hour)} {
			if _, err := env.Repo.CreateBinding(ctx, potatovn.NewBinding{UserID: userID, PVNUserID: 1, PVNUserName: "u", Token: "t", TokenExpires: at}); err != nil {
				t.Fatal(err)
			}
			if _, err := env.Repo.CreateMapping(ctx, potatovn.NewMapping{UserID: userID, GameID: gameID, PVNGalgameID: 5, SyncedAt: now}); err != nil {
				t.Fatal(err)
			}
		}
		count, err := env.Repo.DeleteExpiredBindings(ctx, now)
		if err != nil || count != 1 {
			t.Fatalf("delete expired: %d %v", count, err)
		}
		if _, err := env.Repo.Binding(ctx, stale); !errors.Is(err, potatovn.ErrBindingNotFound) {
			t.Fatalf("stale binding survived: %v", err)
		}
		if _, err := env.Repo.Mapping(ctx, stale, gameID); !errors.Is(err, potatovn.ErrMappingNotFound) {
			t.Fatalf("stale mapping survived: %v", err)
		}
		if _, err := env.Repo.Mapping(ctx, fresh, gameID); err != nil {
			t.Fatalf("fresh mapping removed: %v", err)
		}
	})

	t.Run("mappings are unique per game and per remote entry", func(t *testing.T) {
		env := newEnv(t)
		member := env.NewUser(t)
		first, second := env.NewGame(t, GameFixture{TitleJP: "a"}), env.NewGame(t, GameFixture{TitleJP: "b"})
		played := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
		synced := time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC)
		created, err := env.Repo.CreateMapping(ctx, potatovn.NewMapping{UserID: member, GameID: first, PVNGalgameID: 11, PlayData: potatovn.PlayData{TotalPlayTime: 90, LastPlayDate: &played, PlayType: 2, MyRate: 7}, SyncedAt: synced})
		if err != nil {
			t.Fatal(err)
		}
		if created.PVNGalgameID != 11 || created.TotalPlayTime != 90 || created.LastPlayDate == nil || !created.LastPlayDate.Equal(played) || !created.SyncedAt.Equal(synced) {
			t.Fatalf("unexpected mapping %+v", created)
		}
		if _, err := env.Repo.CreateMapping(ctx, potatovn.NewMapping{UserID: member, GameID: first, PVNGalgameID: 12, SyncedAt: synced}); !errors.Is(err, potatovn.ErrMappingConflict) {
			t.Fatalf("same game twice: %v", err)
		}
		if _, err := env.Repo.CreateMapping(ctx, potatovn.NewMapping{UserID: member, GameID: second, PVNGalgameID: 11, SyncedAt: synced}); !errors.Is(err, potatovn.ErrMappingConflict) {
			t.Fatalf("same remote entry twice: %v", err)
		}
		if _, err := env.Repo.CreateMapping(ctx, potatovn.NewMapping{UserID: member, GameID: 987654, PVNGalgameID: 13, SyncedAt: synced}); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("missing game: %v", err)
		}
		got, err := env.Repo.Mapping(ctx, member, first)
		if err != nil || got.PVNGalgameID != 11 || got.MyRate != 7 {
			t.Fatalf("get mapping %+v %v", got, err)
		}
		if err := env.Repo.DeleteMapping(ctx, member, first); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.DeleteMapping(ctx, member, first); !errors.Is(err, potatovn.ErrMappingNotFound) {
			t.Fatalf("delete missing mapping: %v", err)
		}
	})

	t.Run("sync upserts by remote entry and reports game conflicts", func(t *testing.T) {
		env := newEnv(t)
		member := env.NewUser(t)
		first, second := env.NewGame(t, GameFixture{TitleJP: "a"}), env.NewGame(t, GameFixture{TitleJP: "b"})
		played := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
		at := time.Date(2026, 9, 3, 0, 0, 0, 0, time.UTC)
		if err := env.Repo.SyncMapping(ctx, potatovn.NewMapping{UserID: member, GameID: first, PVNGalgameID: 21, PlayData: potatovn.PlayData{TotalPlayTime: 5, LastPlayDate: &played}, SyncedAt: at}); err != nil {
			t.Fatal(err)
		}
		later := at.Add(time.Hour)
		if err := env.Repo.SyncMapping(ctx, potatovn.NewMapping{UserID: member, GameID: first, PVNGalgameID: 21, PlayData: potatovn.PlayData{TotalPlayTime: 50, MyRate: 9}, SyncedAt: later}); err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Mapping(ctx, member, first)
		if got.TotalPlayTime != 50 || got.MyRate != 9 || got.LastPlayDate != nil || !got.SyncedAt.Equal(later) {
			t.Fatalf("sync must overwrite play data %+v", got)
		}
		if err := env.Repo.SyncMapping(ctx, potatovn.NewMapping{UserID: member, GameID: first, PVNGalgameID: 22, SyncedAt: at}); !errors.Is(err, potatovn.ErrMappingConflict) {
			t.Fatalf("second remote entry for the same game: %v", err)
		}
		if err := env.Repo.SyncMapping(ctx, potatovn.NewMapping{UserID: member, GameID: second, PVNGalgameID: 23, SyncedAt: at}); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.DeleteMappings(ctx, member); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Mapping(ctx, member, second); !errors.Is(err, potatovn.ErrMappingNotFound) {
			t.Fatalf("delete all mappings: %v", err)
		}
	})

	t.Run("catalog reads local game columns", func(t *testing.T) {
		env := newEnv(t)
		released := time.Date(2020, 4, 1, 0, 0, 0, 0, time.UTC)
		gameID := env.NewGame(t, GameFixture{
			VNDBID:      ptr("v17"),
			BangumiID:   ptr("12345"),
			TitleJP:     "タイトル",
			TitleZH:     "标题",
			IntroZH:     "简介",
			ReleaseDate: &released,
			Tags:        []TagFixture{{Name: "Romance"}, {Name: "School", Alias: ptr("校园")}},
			Covers:      []CoverFixture{{URL: "rated.webp", Sexual: 1}, {URL: "violent.webp", Violence: 1}, {URL: "safe.webp"}, {URL: "later.webp"}},
		})
		info, err := env.Catalog.GameInfo(ctx, gameID)
		if err != nil {
			t.Fatal(err)
		}
		tags := slices.Clone(info.Tags)
		slices.Sort(tags)
		if info.ID != gameID || info.VNDBID == nil || *info.VNDBID != "v17" || info.BangumiID == nil || *info.BangumiID != "12345" || info.TitleJP != "タイトル" || info.TitleZH != "标题" ||
			info.IntroZH != "简介" || info.ReleaseDate == nil || !info.ReleaseDate.Equal(released) || !slices.Equal(tags, []string{"Romance", "校园"}) {
			t.Fatalf("unexpected game info %+v", info)
		}
		if info.CoverKey == nil || *info.CoverKey != "safe.webp" {
			t.Fatalf("the first safe cover is used: %v", info.CoverKey)
		}
		if _, err := env.Catalog.GameInfo(ctx, 987654); !errors.Is(err, game.ErrNotFound) {
			t.Fatalf("missing game: %v", err)
		}
		bare := env.NewGame(t, GameFixture{TitleJP: "bare"})
		if info, _ := env.Catalog.GameInfo(ctx, bare); info.CoverKey != nil || info.Tags == nil || len(info.Tags) != 0 {
			t.Fatalf("bare game: %+v", info)
		}
		for name, tc := range map[string]struct {
			bangumi, vndb *string
			want          int
			found         bool
		}{
			"by bangumi": {bangumi: ptr("12345"), want: gameID, found: true},
			"by vndb":    {vndb: ptr("v17"), want: gameID, found: true},
			"either":     {bangumi: ptr("0"), vndb: ptr("v17"), want: gameID, found: true},
			"none":       {bangumi: ptr("0"), vndb: ptr("v0")},
			"no ids":     {},
		} {
			got, found, err := env.Catalog.MatchGame(ctx, tc.bangumi, tc.vndb)
			if err != nil || found != tc.found || (found && got != tc.want) {
				t.Fatalf("%s: got %d %v %v", name, got, found, err)
			}
		}
	})
}
