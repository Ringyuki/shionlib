package ad_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
)

var (
	now     = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	viewer  = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	sponsor = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
)

func newService() (*ad.Service, *adtest.MemoryRepository, *adtest.Cache) {
	repo := adtest.NewMemoryRepository(func() time.Time { return now })
	repo.SetSponsor(sponsor.UserID, now.Add(time.Hour))
	cache := adtest.NewCache()
	return ad.NewService(repo, repo, cache, func() time.Time { return now }), repo, cache
}

func ptr[T any](v T) *T {
	return &v
}

func TestPlacementSkipsSponsorsAndCaches(t *testing.T) {
	ctx := context.Background()
	service, repo, cache := newService()
	if _, err := service.Create(ctx, ad.NewAd{Name: "banner", Placement: []string{"home-after-hot"}, ImageZH: "zh.webp", Aspect: "16:9", Link: "https://x.test", Enabled: true}); err != nil {
		t.Fatal(err)
	}
	ads, err := service.Placement(ctx, sponsor, "home-after-hot")
	if err != nil || ads == nil || len(ads) != 0 {
		t.Fatalf("sponsors see no ads: %v %v", ads, err)
	}
	if cache.Has("ad:placement:home-after-hot") {
		t.Fatal("sponsor requests must not touch the cache")
	}
	ads, err = service.Placement(ctx, viewer, "home-after-hot")
	if err != nil || len(ads) != 1 {
		t.Fatalf("viewer sees the ad: %v %v", ads, err)
	}
	if !cache.Has("ad:placement:home-after-hot") {
		t.Fatal("placement result must be cached")
	}
	if err := repo.Delete(ctx, ads[0].ID); err != nil {
		t.Fatal(err)
	}
	cached, _ := service.Placement(ctx, actor.Guest(), "home-after-hot")
	if len(cached) != 1 {
		t.Fatalf("second read comes from the cache: %v", cached)
	}
	empty, _ := service.Placement(ctx, actor.Guest(), "nowhere")
	if empty == nil || len(empty) != 0 || !cache.Has("ad:placement:nowhere") {
		t.Fatalf("empty placements are cached too: %v", empty)
	}
}

func TestWritesInvalidateOnlyAdKeys(t *testing.T) {
	ctx := context.Background()
	service, _, cache := newService()
	for _, key := range []string{"ad:placement:home", "message:unread:1", "s3-upload:5"} {
		_ = cache.Set(ctx, key, []int{}, time.Minute)
	}
	created, err := service.Create(ctx, ad.NewAd{Name: "a", ImageZH: "zh", Aspect: "1:1", Link: "l"})
	if err != nil {
		t.Fatal(err)
	}
	if created.Placement == nil || created.ExcludeLocales == nil {
		t.Fatalf("arrays default to empty: %+v", created)
	}
	if cache.Has("ad:placement:home") || !cache.Has("message:unread:1") || !cache.Has("s3-upload:5") {
		t.Fatal("create must only drop ad placement keys")
	}
	_ = cache.Set(ctx, "ad:placement:home", []int{}, time.Minute)
	if _, err := service.Update(ctx, created.ID, ad.Changes{Name: ptr("b")}); err != nil {
		t.Fatal(err)
	}
	if cache.Has("ad:placement:home") {
		t.Fatal("update must drop ad placement keys")
	}
	_ = cache.Set(ctx, "ad:placement:home", []int{}, time.Minute)
	if err := service.Delete(ctx, created.ID); err != nil {
		t.Fatal(err)
	}
	if cache.Has("ad:placement:home") || !cache.Has("message:unread:1") {
		t.Fatal("delete must only drop ad placement keys")
	}
}

func TestMissingAds(t *testing.T) {
	ctx := context.Background()
	service, _, _ := newService()
	if _, err := service.Get(ctx, 9); !errors.Is(err, ad.ErrNotFound) {
		t.Fatalf("get: %v", err)
	}
	if _, err := service.Update(ctx, 9, ad.Changes{}); !errors.Is(err, ad.ErrNotFound) {
		t.Fatalf("update: %v", err)
	}
	if err := service.Delete(ctx, 9); !errors.Is(err, ad.ErrNotFound) {
		t.Fatalf("delete: %v", err)
	}
}
