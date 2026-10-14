package indexing_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

var now = time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)

type feed struct {
	changes []indexing.Change
	since   []time.Time
}

func (f *feed) Changes(_ context.Context, since time.Time, _ int) ([]indexing.Change, error) {
	f.since = append(f.since, since)
	return f.changes, nil
}

type submitter struct{ batches [][]string }

func (s *submitter) Submit(_ context.Context, urls []string) error {
	s.batches = append(s.batches, urls)
	return nil
}

type cursor struct {
	at    time.Time
	found bool
}

func (c *cursor) Load(context.Context) (time.Time, bool, error) { return c.at, c.found, nil }

func (c *cursor) Save(_ context.Context, at time.Time) error {
	c.at, c.found = at, true
	return nil
}

func service(f *feed, s *submitter, c *cursor, enabled bool) *indexing.Service {
	settings := settingtest.Set(settingtest.Source{}, indexing.Enabled, enabled)
	return indexing.NewService(f, s, c, settings, indexing.Options{SiteURL: "https://shionlib.com", Key: "k"}, func() time.Time { return now })
}

func TestPushSendsTheChineseAddressesOfWhatChanged(t *testing.T) {
	earlier := now.Add(-time.Hour)
	f := &feed{changes: []indexing.Change{
		{Kind: indexing.ChangeResource, ID: 8046, GameID: 962, At: earlier.Add(time.Minute)},
		{Kind: indexing.ChangeResource, ID: 8047, GameID: 962, At: earlier.Add(2 * time.Minute)},
		{Kind: indexing.ChangeWalkthrough, ID: 42, GameID: 365, At: earlier.Add(3 * time.Minute)},
	}}
	s, c := &submitter{}, &cursor{at: earlier, found: true}
	pushed, err := service(f, s, c, true).Push(context.Background())
	if err != nil || pushed != 4 {
		t.Fatalf("pushed %d %v", pushed, err)
	}
	want := []string{
		"https://shionlib.com/zh/resource/8046",
		"https://shionlib.com/zh/game/962",
		"https://shionlib.com/zh/resource/8047",
		"https://shionlib.com/zh/game/365/walkthrough/42",
	}
	if len(s.batches) != 1 || !slices.Equal(s.batches[0], want) {
		t.Fatalf("unexpected batches %v", s.batches)
	}
	if !f.since[0].Equal(earlier) || !c.at.Equal(earlier.Add(3*time.Minute)) {
		t.Fatalf("the cursor moves to the last change: %v %v", f.since, c.at)
	}
}

func TestPushStartsFromNowAndStaysOffUntilEnabled(t *testing.T) {
	f, s, c := &feed{changes: []indexing.Change{{Kind: indexing.ChangeResource, ID: 1, GameID: 2, At: now}}}, &submitter{}, &cursor{}
	if pushed, err := service(f, s, c, false).Push(context.Background()); err != nil || pushed != 0 || c.found || len(f.since) != 0 {
		t.Fatalf("a disabled push does nothing: %d %v %+v", pushed, err, c)
	}
	if pushed, err := service(f, s, c, true).Push(context.Background()); err != nil || pushed != 0 || !c.at.Equal(now) || len(s.batches) != 0 {
		t.Fatalf("the first push only marks where to start: %d %v %+v", pushed, err, c)
	}
}
