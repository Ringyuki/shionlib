package adhttp_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

var (
	viewer  = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	sponsor = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	admin   = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	adult   = actor.Actor{UserID: 4, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
)

var today = time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)

type fixture struct {
	server   *apitest.Server
	repo     *adtest.MemoryRepository
	settings settingtest.Source
}

func newFixture(t *testing.T, store ad.Cache) *fixture {
	t.Helper()
	server := apitest.New(t)
	repo := adtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.SetSponsor(sponsor.UserID, apitest.Now.Add(time.Hour))
	if store == nil {
		store = adtest.NewCache()
	}
	settings := settingtest.Source{}
	now := func() time.Time { return apitest.Now }
	options := ad.Options{ClockOffset: 8 * time.Hour}
	service := ad.NewService(ad.Deps{Repo: repo, Cache: store, Settings: settings, Now: now, Options: options})
	placements := ad.NewPlacementService(ad.PlacementDeps{
		Repo:     repo,
		Sponsors: repo,
		Cache:    store,
		Guard:    adtest.NewClickGuard(),
		Settings: settings,
		Now:      now,
		Random:   func() float64 { return 0 },
		Options:  options,
	})
	adhttp.NewHandler(service, placements, server.Builder).Register(server.API)
	return &fixture{server: server, repo: repo, settings: settings}
}

func (f *fixture) create(t *testing.T, draft ad.Draft) ad.Ad {
	t.Helper()
	created, err := f.repo.Create(context.Background(), draft)
	if err != nil {
		t.Fatal(err)
	}
	return created
}
