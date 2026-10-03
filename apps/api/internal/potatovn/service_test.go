package potatovn_test

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn/potatovntest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	now    = time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	member = actor.Actor{UserID: 5, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
)

type fixture struct {
	repo      *potatovntest.MemoryRepository
	client    *potatovntest.Client
	scheduler *potatovntest.Scheduler
	covers    potatovntest.Covers
	service   *potatovn.Service
}

func newFixture() fixture {
	repo := potatovntest.NewMemoryRepository(func() time.Time { return now })
	client := potatovntest.NewClient()
	client.Accounts["alice"] = "secret"
	scheduler := &potatovntest.Scheduler{}
	covers := potatovntest.Covers{"safe.webp": {Data: []byte("img"), ContentType: ""}}
	service := potatovn.NewService(repo, repo, client, covers, &txtest.Immediate{}, scheduler.Schedule, func() time.Time { return now })
	return fixture{repo: repo, client: client, scheduler: scheduler, covers: covers, service: service}
}

func (f fixture) bind(t *testing.T, userID int) {
	t.Helper()
	if _, err := f.repo.CreateBinding(context.Background(), potatovn.NewBinding{UserID: userID, PVNUserID: 1, PVNUserName: "u", Token: "token", TokenExpires: now.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
}

func ptr[T any](v T) *T {
	return &v
}

func TestBind(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if _, err := f.service.Bind(ctx, member, "alice", "wrong"); !errors.Is(err, potatovn.ErrBindingAuthFailed) {
		t.Fatalf("wrong password: %v", err)
	}
	binding, err := f.service.Bind(ctx, member, "alice", "secret")
	if err != nil {
		t.Fatal(err)
	}
	if binding.PVNUserName != "Canonicalalice" || binding.PVNUserID != 77 || binding.Token != "token-alice" || !binding.TokenExpires.Equal(f.client.Expires) {
		t.Fatalf("binding stores the canonical PotatoVN account: %+v", binding)
	}
	if len(f.scheduler.Jobs) != 1 || f.scheduler.Jobs[0].UserID != member.UserID {
		t.Fatalf("binding schedules a library sync: %+v", f.scheduler.Jobs)
	}
	if _, err := f.service.Bind(ctx, member, "alice", "secret"); !errors.Is(err, potatovn.ErrBindingAlreadyExists) {
		t.Fatalf("second binding: %v", err)
	}
	got, err := f.service.Binding(ctx, member)
	if err != nil || got.PVNUserID != 77 {
		t.Fatalf("binding: %+v %v", got, err)
	}
}

func TestUnbindRemovesMappings(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if err := f.service.Unbind(ctx, member); !errors.Is(err, potatovn.ErrBindingNotFound) {
		t.Fatalf("unbind without binding: %v", err)
	}
	f.bind(t, member.UserID)
	f.repo.AddGame(potatovn.GameInfo{ID: 1})
	if _, err := f.repo.CreateMapping(ctx, potatovn.NewMapping{UserID: member.UserID, GameID: 1, PVNGalgameID: 9}); err != nil {
		t.Fatal(err)
	}
	if err := f.service.Unbind(ctx, member); err != nil {
		t.Fatal(err)
	}
	if mappings := f.repo.Mappings(member.UserID); len(mappings) != 0 {
		t.Fatalf("mappings survived unbind: %+v", mappings)
	}
	if _, err := f.service.Binding(ctx, member); !errors.Is(err, potatovn.ErrBindingNotFound) {
		t.Fatalf("binding survived unbind: %v", err)
	}
}

func TestRefreshExpiringTokens(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.client.Expires = now.Add(2 * time.Hour)
	f.bind(t, 1)
	if _, err := f.repo.CreateBinding(ctx, potatovn.NewBinding{UserID: 2, PVNUserID: 2, PVNUserName: "far", Token: "far", TokenExpires: now.Add(10 * 24 * time.Hour)}); err != nil {
		t.Fatal(err)
	}
	if err := f.service.RefreshExpiringTokens(ctx); err != nil {
		t.Fatal(err)
	}
	near, _ := f.repo.Binding(ctx, 1)
	far, _ := f.repo.Binding(ctx, 2)
	if near.Token != "token-refreshed" || far.Token != "far" {
		t.Fatalf("only bindings within three days are refreshed: %q %q", near.Token, far.Token)
	}
	f.client.FailRefresh = errors.New("401")
	err := f.service.RefreshExpiringTokens(ctx)
	if !errors.Is(err, potatovn.ErrBindingAuthFailed) {
		t.Fatalf("refresh failures are reported per user: %v", err)
	}
	if kept, _ := f.repo.Binding(ctx, 1); kept.Token != "token-refreshed" {
		t.Fatalf("failed refreshes keep the binding: %+v", kept)
	}
}

func TestCleanExpiredBindings(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if _, err := f.repo.CreateBinding(ctx, potatovn.NewBinding{UserID: 1, Token: "t", TokenExpires: now.Add(-time.Minute)}); err != nil {
		t.Fatal(err)
	}
	f.bind(t, 2)
	if err := f.service.CleanExpiredBindings(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.Binding(ctx, 1); !errors.Is(err, potatovn.ErrBindingNotFound) {
		t.Fatalf("expired binding survived: %v", err)
	}
	if _, err := f.repo.Binding(ctx, 2); err != nil {
		t.Fatalf("live binding removed: %v", err)
	}
}

func TestScheduleLibrarySyncs(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	for userID := 1; userID <= potatovn.SyncScheduleBatch+2; userID++ {
		f.bind(t, userID)
	}
	if err := f.service.ScheduleLibrarySyncs(ctx); err != nil {
		t.Fatal(err)
	}
	if len(f.scheduler.Jobs) != potatovn.SyncScheduleBatch+2 || f.scheduler.Jobs[len(f.scheduler.Jobs)-1].UserID != potatovn.SyncScheduleBatch+2 {
		t.Fatalf("every binding gets one sync job: %d", len(f.scheduler.Jobs))
	}
}

func TestSyncLibrary(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if err := f.service.SyncLibrary(ctx, member.UserID); err != nil {
		t.Fatalf("users without a binding are skipped: %v", err)
	}
	f.bind(t, member.UserID)
	f.repo.AddGame(potatovn.GameInfo{ID: 1, BangumiID: ptr("100")})
	f.repo.AddGame(potatovn.GameInfo{ID: 2, VNDBID: ptr("v200")})
	f.client.PageSize = 2
	f.client.Galgames = []potatovn.Galgame{
		{ID: 11, BangumiID: ptr("100"), TotalPlayTime: 60, PlayType: 2, MyRate: 9, Sessions: []potatovn.PlaySession{{At: now.Add(-48 * time.Hour)}, {At: now.Add(-time.Hour)}}},
		{ID: 12, VNDBID: ptr("200"), TotalPlayTime: 5},
		{ID: 13, VNDBID: ptr("999")},
		{ID: 14},
		{ID: 15, VNDBID: ptr("v200")},
	}
	if err := f.service.SyncLibrary(ctx, member.UserID); err != nil {
		t.Fatal(err)
	}
	mappings := f.repo.Mappings(member.UserID)
	if len(mappings) != 2 {
		t.Fatalf("matched games across every page are mapped: %+v", mappings)
	}
	if first := mappings[0]; first.PVNGalgameID != 11 || first.TotalPlayTime != 60 || first.LastPlayDate == nil || !first.LastPlayDate.Equal(now.Add(-time.Hour)) || !first.SyncedAt.Equal(now) {
		t.Fatalf("play data comes from the latest session: %+v", first)
	}
	if second := mappings[1]; second.PVNGalgameID != 12 || second.GameID != 2 {
		t.Fatalf("numeric vndb ids get the v prefix: %+v", second)
	}
	f.client.FailLibrary = potatovn.ErrRequestFailed
	if err := f.service.SyncLibrary(ctx, member.UserID); !errors.Is(err, potatovn.ErrRequestFailed) {
		t.Fatalf("library failures surface to the job: %v", err)
	}
}

func TestAddGame(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	released := time.Date(2020, 4, 1, 12, 0, 0, 500_000_000, time.UTC)
	f.repo.AddGame(potatovn.GameInfo{ID: 20, VNDBID: ptr("v1"), BangumiID: ptr("2"), TitleZH: "标题", TitleEN: "Title", IntroJP: "紹介", Tags: []string{"A"}, ReleaseDate: &released, CoverKey: ptr("safe.webp")})
	f.repo.AddGame(potatovn.GameInfo{ID: 21, TitleJP: "nocover"})

	if _, err := f.service.AddGame(ctx, member, 404); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	if _, err := f.service.AddGame(ctx, member, 20); !errors.Is(err, potatovn.ErrBindingNotFound) {
		t.Fatalf("unbound user: %v", err)
	}
	f.bind(t, member.UserID)
	mapping, err := f.service.AddGame(ctx, member, 20)
	if err != nil {
		t.Fatal(err)
	}
	if mapping.PVNGalgameID != 1001 || mapping.TotalPlayTime != 30 || mapping.MyRate != 8 || mapping.LastPlayDate == nil || !mapping.LastPlayDate.Equal(time.Unix(1700086400, 0)) {
		t.Fatalf("unexpected mapping %+v", mapping)
	}
	draft := f.client.Saved[0]
	if draft.Name != "标题" || draft.CnName != "标题" || draft.Description != "紹介" || *draft.VNDBID != "v1" || *draft.BangumiID != "2" || draft.PlayType != 0 ||
		draft.ReleaseTimestamp == nil || *draft.ReleaseTimestamp != float64(released.UnixMilli())/1000 {
		t.Fatalf("unexpected draft %+v", draft)
	}
	if draft.ImageLoc == nil || !regexp.MustCompile(`^shionlib/game/20/[0-9a-f-]{36}\.webp$`).MatchString(*draft.ImageLoc) {
		t.Fatalf("cover is uploaded to PotatoVN storage: %v", draft.ImageLoc)
	}
	if len(f.client.Reserved) != 1 || len(f.client.Uploaded) != 1 || len(f.client.Committed) != 1 {
		t.Fatalf("reserve, upload and commit once: %+v", f.client)
	}
	again, err := f.service.AddGame(ctx, member, 20)
	if err != nil || again.PVNGalgameID != mapping.PVNGalgameID || len(f.client.Saved) != 1 {
		t.Fatalf("adding twice returns the existing mapping without a remote call: %+v %v", again, err)
	}

	f.client.FailUpload = errors.New("oss down")
	if _, err := f.service.AddGame(ctx, member, 21); err != nil {
		t.Fatal(err)
	}
	if f.client.Saved[1].ImageLoc != nil || len(f.client.Committed) != 1 {
		t.Fatalf("games without a safe cover skip the upload: %+v", f.client.Saved[1])
	}
	f.repo.AddGame(potatovn.GameInfo{ID: 22, TitleJP: "x", CoverKey: ptr("safe.webp")})
	if _, err := f.service.AddGame(ctx, member, 22); err != nil {
		t.Fatalf("cover failures are not fatal: %v", err)
	}
	if f.client.Saved[2].ImageLoc != nil || len(f.client.Committed) != 2 {
		t.Fatalf("a failed upload still releases the reserved space: %+v", f.client)
	}
}

func TestRemoveGame(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if err := f.service.RemoveGame(ctx, member, 1); !errors.Is(err, potatovn.ErrMappingNotFound) {
		t.Fatalf("missing mapping: %v", err)
	}
	f.bind(t, member.UserID)
	f.repo.AddGame(potatovn.GameInfo{ID: 1})
	f.repo.AddGame(potatovn.GameInfo{ID: 2})
	_, _ = f.repo.CreateMapping(ctx, potatovn.NewMapping{UserID: member.UserID, GameID: 1, PVNGalgameID: 31})
	_, _ = f.repo.CreateMapping(ctx, potatovn.NewMapping{UserID: member.UserID, GameID: 2, PVNGalgameID: 32})

	f.client.FailRemove = potatovn.ErrRequestFailed
	if err := f.service.RemoveGame(ctx, member, 1); !errors.Is(err, potatovn.ErrRequestFailed) {
		t.Fatalf("remote failures keep the mapping: %v", err)
	}
	if _, err := f.service.GameData(ctx, member, 1); err != nil {
		t.Fatalf("mapping must survive a failed remote delete: %v", err)
	}
	f.client.FailRemove = nil
	if err := f.service.RemoveGame(ctx, member, 1); err != nil {
		t.Fatal(err)
	}
	if len(f.client.Removed) != 1 || f.client.Removed[0] != 31 {
		t.Fatalf("remote entry removed: %v", f.client.Removed)
	}
	f.client.FailRemove = potatovn.ErrRemoteGalgameMissing
	if err := f.service.RemoveGame(ctx, member, 2); err != nil {
		t.Fatalf("entries already gone remotely are removed locally: %v", err)
	}
	if _, err := f.service.GameData(ctx, member, 2); !errors.Is(err, potatovn.ErrMappingNotFound) {
		t.Fatalf("mapping should be gone: %v", err)
	}
}
