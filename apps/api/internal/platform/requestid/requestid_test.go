package requestid_test

import (
	"context"
	"regexp"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
)

var uuidV4 = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func TestNewIDsAreRandomUUIDs(t *testing.T) {
	first, second := requestid.New(), requestid.New()
	if !uuidV4.MatchString(first) || first == second || !requestid.Acceptable(first) {
		t.Fatalf("ids %q %q", first, second)
	}
}

func TestOnlyWellFormedUpstreamIDsAreAccepted(t *testing.T) {
	for id, want := range map[string]bool{
		"abc-123_def:9.0":         true,
		"short":                   false,
		"has space here":          false,
		"<script>alert1":          false,
		string(make([]byte, 129)): false,
	} {
		if requestid.Acceptable(id) != want {
			t.Fatalf("%q: want %v", id, want)
		}
	}
}

func TestContextRoundTrip(t *testing.T) {
	if requestid.From(context.Background()) != "" {
		t.Fatal("empty context has no id")
	}
	if requestid.From(requestid.With(context.Background(), "req-12345678")) != "req-12345678" {
		t.Fatal("round trip")
	}
}
