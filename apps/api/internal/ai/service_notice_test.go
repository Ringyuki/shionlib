package ai_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

func TestNoticesReachSuperAdminsWhileTheStatusHolds(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	admin := f.repo.AddSuperAdmin()
	if _, err := f.repo.SuspendRoute(t.Context(), setup.primary, ai.Failure{Kind: ai.ErrorQuota, Message: "HTTP 402"}, f.clock.Now()); err != nil {
		t.Fatal(err)
	}
	if err := f.notices.Announce(t.Context(), ai.RouteStatusNotice{RouteID: setup.primary, Suspended: true}); err != nil {
		t.Fatal(err)
	}
	if len(f.messenger.sent) != 1 {
		t.Fatalf("sent %+v", f.messenger.sent)
	}
	sent := f.messenger.sent[0]
	if sent.ReceiverID != admin || sent.Tone != message.ToneWarning || sent.Meta["provider"] != "alpha" || sent.Meta["error_kind"] != "quota" {
		t.Fatalf("message %+v", sent)
	}
	if err := f.notices.Announce(t.Context(), ai.RouteStatusNotice{RouteID: setup.primary, Suspended: false}); err != nil {
		t.Fatal(err)
	}
	if err := f.notices.Announce(t.Context(), ai.RouteStatusNotice{RouteID: 999, Suspended: true}); err != nil {
		t.Fatal(err)
	}
	if len(f.messenger.sent) != 1 {
		t.Fatalf("stale notices are dropped: %+v", f.messenger.sent)
	}
}
