package sitemap_test

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
)

type store struct {
	counts  map[sitemap.Section]int
	entries map[sitemap.Section][]sitemap.Entry
	offsets []int
}

func (s *store) Count(_ context.Context, section sitemap.Section) (int, error) {
	return s.counts[section], nil
}

func (s *store) Entries(_ context.Context, section sitemap.Section, offset, limit int) ([]sitemap.Entry, error) {
	s.offsets = append(s.offsets, offset)
	all := s.entries[section]
	start := min(offset, len(all))
	return all[start:min(start+limit, len(all))], nil
}

var modified = time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)

func TestSectionsCountOnePagePerFiftyThousandEntries(t *testing.T) {
	cache := gametest.NewCache()
	s := &store{counts: map[sitemap.Section]int{sitemap.SectionGame: 3, sitemap.SectionCharacter: 50001}}
	service := sitemap.NewService(s, cache)
	sections, err := service.Sections(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := []sitemap.SectionPages{
		{Section: sitemap.SectionGame, Pages: 1},
		{Section: sitemap.SectionResource, Pages: 0},
		{Section: sitemap.SectionWalkthrough, Pages: 0},
		{Section: sitemap.SectionDeveloper, Pages: 0},
		{Section: sitemap.SectionCharacter, Pages: 2},
		{Section: sitemap.SectionTranslator, Pages: 0},
	}
	if !reflect.DeepEqual(sections, want) {
		t.Fatalf("unexpected sections %+v", sections)
	}
	if cache.TTLs["sitemap:sections"] != time.Hour {
		t.Fatalf("sections are cached for an hour: %v", cache.TTLs)
	}
	s.counts[sitemap.SectionGame] = 0
	if again, _ := service.Sections(context.Background()); !reflect.DeepEqual(again, want) {
		t.Fatal("cached sections must be served")
	}
}

func TestEntriesArePagedAndCached(t *testing.T) {
	cache := gametest.NewCache()
	walkthrough := sitemap.Entry{ID: 4, GameID: 9, Modified: &modified}
	s := &store{entries: map[sitemap.Section][]sitemap.Entry{sitemap.SectionWalkthrough: {walkthrough}, sitemap.SectionDeveloper: {{ID: 2}}}}
	service := sitemap.NewService(s, cache)
	entries, err := service.Entries(context.Background(), sitemap.SectionWalkthrough, 1)
	if err != nil || len(entries) != 1 || entries[0].GameID != 9 || !entries[0].Modified.Equal(modified) {
		t.Fatalf("unexpected entries %+v %v", entries, err)
	}
	if !cache.Has("sitemap:entries:walkthrough:1") {
		t.Fatal("entries are cached per section and page")
	}
	beyond, _ := service.Entries(context.Background(), sitemap.SectionDeveloper, 3)
	if len(beyond) != 0 || s.offsets[len(s.offsets)-1] != 100000 {
		t.Fatalf("pages beyond the data are empty: %+v %v", beyond, s.offsets)
	}
	for _, invalid := range []struct {
		section sitemap.Section
		page    int
	}{{"user", 1}, {sitemap.SectionGame, 0}} {
		if entries, _ := service.Entries(context.Background(), invalid.section, invalid.page); len(entries) != 0 || len(s.offsets) != 2 {
			t.Fatalf("unknown sections and pages are empty without a query: %+v %v", entries, s.offsets)
		}
	}
}
