package apikey_test

import (
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func TestAuthenticateTellsWhyAKeyIsRefused(t *testing.T) {
	f := newFixture(t)
	good, err := f.service.Create(t.Context(), owner, "good")
	if err != nil {
		t.Fatal(err)
	}
	ofBanned, err := f.service.Create(t.Context(), banned, "banned")
	if err != nil {
		t.Fatal(err)
	}
	suspended, err := f.service.Create(t.Context(), owner, "suspended")
	if err != nil {
		t.Fatal(err)
	}
	if err := f.admin.Suspend(t.Context(), admin, suspended.Key.ID, "abuse"); err != nil {
		t.Fatal(err)
	}
	cases := map[string]struct {
		secret string
		want   error
	}{
		"nothing given": {"", apikey.ErrKeyRequired},
		"not a key":     {"eyJhbGciOi", apikey.ErrKeyInvalid},
		"unknown":       {"shl_unknown", apikey.ErrKeyInvalid},
		"suspended":     {suspended.Secret, apikey.ErrKeySuspended},
		"owner banned":  {ofBanned.Secret, apikey.ErrOwnerBanned},
	}
	for name, c := range cases {
		if _, err := f.access.Authenticate(t.Context(), c.secret, "203.0.113.1"); !errors.Is(err, c.want) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	holder, err := f.access.Authenticate(t.Context(), good.Secret, "203.0.113.1")
	if err != nil || holder.KeyID != good.Key.ID || holder.UserID != owner.UserID || holder.Limit != nil {
		t.Fatalf("a good key: %+v %v", holder, err)
	}
	settingtest.Set(f.settings, apikey.Enabled, false)
	if _, err := f.access.Authenticate(t.Context(), good.Secret, "203.0.113.1"); !errors.Is(err, apikey.ErrClosed) {
		t.Fatalf("closed: %v", err)
	}
}

func TestAuthenticateRecordsTheLastUseAtMostEveryFiveMinutes(t *testing.T) {
	f := newFixture(t)
	issued, err := f.service.Create(t.Context(), owner, "k")
	if err != nil {
		t.Fatal(err)
	}
	limit := 300
	if err := f.admin.SetAccountLimit(t.Context(), owner.UserID, &limit); err != nil {
		t.Fatal(err)
	}
	first := *f.clock
	holder, err := f.access.Authenticate(t.Context(), issued.Secret, "203.0.113.1")
	if err != nil || holder.Limit == nil || *holder.Limit != 300 {
		t.Fatalf("the account's own limit travels with the key: %+v %v", holder, err)
	}
	*f.clock = first.Add(time.Minute)
	if _, err := f.access.Authenticate(t.Context(), issued.Secret, "203.0.113.2"); err != nil {
		t.Fatal(err)
	}
	key, _ := f.repo.Get(t.Context(), issued.Key.ID)
	if !key.LastUsedAt.Equal(first) || *key.LastUsedIP != "203.0.113.1" {
		t.Fatalf("not written again within five minutes: %+v", key)
	}
	*f.clock = first.Add(apikey.TouchInterval)
	if _, err := f.access.Authenticate(t.Context(), issued.Secret, "203.0.113.3"); err != nil {
		t.Fatal(err)
	}
	key, _ = f.repo.Get(t.Context(), issued.Key.ID)
	if !key.LastUsedAt.Equal(first.Add(apikey.TouchInterval)) || *key.LastUsedIP != "203.0.113.3" {
		t.Fatalf("written again after five minutes: %+v", key)
	}
}

func TestFlushSavesTheCountsOfTodayAndYesterdayAndPrunesOldDays(t *testing.T) {
	f := newFixture(t)
	holder := apikey.Holder{KeyID: 7, UserID: owner.UserID}
	*f.clock = time.Date(2026, 10, 13, 15, 59, 0, 0, time.UTC)
	for _, throttled := range []bool{false, false, true} {
		if err := f.access.Record(t.Context(), holder, throttled); err != nil {
			t.Fatal(err)
		}
	}
	*f.clock = time.Date(2026, 10, 13, 16, 1, 0, 0, time.UTC)
	if err := f.access.Record(t.Context(), holder, false); err != nil {
		t.Fatal(err)
	}
	if err := f.access.Flush(t.Context()); err != nil {
		t.Fatal(err)
	}
	if len(f.usage.Saved) != 2 {
		t.Fatalf("one count a day: %+v", f.usage.Saved)
	}
	yesterday, today := f.usage.Saved[0], f.usage.Saved[1]
	if yesterday.Day.Format(time.DateOnly) != "2026-10-13" || yesterday.Requests != 2 || yesterday.Throttled != 1 || today.Day.Format(time.DateOnly) != "2026-10-14" || today.Requests != 1 {
		t.Fatalf("days are counted in UTC+8: %+v", f.usage.Saved)
	}
	if len(f.usage.Pruned) != 1 || f.usage.Pruned[0].Format(time.DateOnly) != "2026-07-16" {
		t.Fatalf("90 days are kept: %v", f.usage.Pruned)
	}
}
