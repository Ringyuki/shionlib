package apikey_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

func TestSuspendAndRestoreTellTheOwner(t *testing.T) {
	f := newFixture(t)
	issued, err := f.service.Create(t.Context(), owner, "bot")
	if err != nil {
		t.Fatal(err)
	}
	if err := f.admin.Suspend(t.Context(), admin, issued.Key.ID, " ignores Retry-After "); err != nil {
		t.Fatal(err)
	}
	key, _ := f.repo.Get(t.Context(), issued.Key.ID)
	if !key.Suspended() || *key.SuspendedReason != "ignores Retry-After" {
		t.Fatalf("suspended: %+v", key)
	}
	if err := f.admin.Restore(t.Context(), issued.Key.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.admin.Restore(t.Context(), issued.Key.ID); err != nil {
		t.Fatal(err)
	}
	sent := f.messages.Sent
	if len(sent) != 2 || sent[0].Title != "Messages.System.APIKey.Suspended.Title" || sent[0].Tone != message.ToneWarning || sent[0].ReceiverID != owner.UserID || sent[0].Meta["reason"] != "ignores Retry-After" || sent[1].Content != "Messages.System.APIKey.Restored.Content" {
		t.Fatalf("one notice for each change and none for a key already active: %+v", sent)
	}
}

func TestDaysAreFilledUpToToday(t *testing.T) {
	f := newFixture(t)
	f.usage.DayRows = []apikey.Day{{Day: time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC), Requests: 5, Throttled: 1}}
	days, err := f.admin.Days(t.Context(), 7)
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 7 || days[0].Day.Format(time.DateOnly) != "2026-10-08" || days[6].Day.Format(time.DateOnly) != "2026-10-14" || days[4].Requests != 5 || days[5].Requests != 0 {
		t.Fatalf("seven days ending today: %+v", days)
	}
	summary, err := f.admin.Summary(t.Context())
	if err != nil || !summary.Enabled {
		t.Fatalf("the summary says whether the API is open: %+v %v", summary, err)
	}
}
