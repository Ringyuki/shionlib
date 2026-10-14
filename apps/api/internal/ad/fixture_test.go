package ad_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

var now = time.Date(2026, 10, 15, 3, 0, 0, 0, time.UTC)

func ptr[T any](v T) *T {
	return &v
}

type fixture struct {
	repo       *adtest.MemoryRepository
	cache      *adtest.Cache
	guard      *adtest.ClickGuard
	settings   settingtest.Source
	service    *ad.Service
	placements *ad.PlacementService
	draws      []float64
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{
		repo:     adtest.NewMemoryRepository(func() time.Time { return now }),
		cache:    adtest.NewCache(),
		guard:    adtest.NewClickGuard(),
		settings: settingtest.Source{},
	}
	options := ad.Options{ClockOffset: 8 * time.Hour}
	f.service = ad.NewService(ad.Deps{Repo: f.repo, Cache: f.cache, Settings: f.settings, Now: func() time.Time { return now }, Options: options})
	f.placements = ad.NewPlacementService(ad.PlacementDeps{
		Repo:     f.repo,
		Sponsors: f.repo,
		Cache:    f.cache,
		Guard:    f.guard,
		Settings: f.settings,
		Now:      func() time.Time { return now },
		Random:   f.draw,
		Options:  options,
	})
	return f
}

func (f *fixture) draw() float64 {
	if len(f.draws) == 0 {
		return 0
	}
	next := f.draws[0]
	f.draws = f.draws[1:]
	return next
}

func (f *fixture) create(t *testing.T, draft ad.Draft) ad.Ad {
	t.Helper()
	created, err := f.service.Create(t.Context(), draft)
	if err != nil {
		t.Fatal(err)
	}
	return created
}

func names(shown []ad.Shown) []string {
	out := make([]string, len(shown))
	for i, item := range shown {
		out[i] = item.Name
	}
	return out
}
