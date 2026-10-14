package apikey_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func TestCreateShowsTheWholeKeyOnceAndKeepsItsPrefix(t *testing.T) {
	f := newFixture(t)
	issued, err := f.service.Create(t.Context(), owner, "  ReinaManager ")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(issued.Secret, apikey.SecretPrefix) || len(issued.Secret) != 47 {
		t.Fatalf("a key is shl_ and 43 characters: %q", issued.Secret)
	}
	if issued.Key.Prefix != issued.Secret[:apikey.ShownPrefixLength] || issued.Key.Name != "ReinaManager" {
		t.Fatalf("unexpected key %+v", issued.Key)
	}
	again, err := f.service.Create(t.Context(), owner, "second")
	if err != nil || again.Secret == issued.Secret {
		t.Fatalf("every key is new: %v", err)
	}
	mine, err := f.service.Mine(t.Context(), owner)
	if err != nil || len(mine.Keys) != 2 || mine.Limit != 10 || !mine.Enabled {
		t.Fatalf("unexpected keys %+v %v", mine, err)
	}
}

func TestCreateStopsAtTheLimitAndWhileTheAPIIsClosed(t *testing.T) {
	f := newFixture(t)
	settingtest.Set(f.settings, apikey.MaxKeys, 1)
	if _, err := f.service.Create(t.Context(), owner, "one"); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.Create(t.Context(), owner, "two"); !errors.Is(err, apikey.ErrTooManyKeys) {
		t.Fatalf("the limit: %v", err)
	}
	settingtest.Set(f.settings, apikey.Enabled, false)
	if _, err := f.service.Create(t.Context(), banned, "closed"); !errors.Is(err, apikey.ErrClosed) {
		t.Fatalf("closed: %v", err)
	}
}

func TestDeleteRemovesOnlyTheCallersKey(t *testing.T) {
	f := newFixture(t)
	issued, err := f.service.Create(t.Context(), owner, "mine")
	if err != nil {
		t.Fatal(err)
	}
	if err := f.service.Delete(t.Context(), banned, issued.Key.ID); !errors.Is(err, apikey.ErrNotFound) {
		t.Fatalf("someone else's key: %v", err)
	}
	if err := f.service.Delete(t.Context(), owner, issued.Key.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.access.Authenticate(t.Context(), issued.Secret, "203.0.113.1"); !errors.Is(err, apikey.ErrKeyInvalid) {
		t.Fatalf("a deleted key fails at once: %v", err)
	}
}
