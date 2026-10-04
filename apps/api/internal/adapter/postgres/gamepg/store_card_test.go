package gamepg_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

var _ game.CardStore = (*gamepg.CardStore)(nil)

func TestCardsSummarizePublicResources(t *testing.T) {
	f := newFixtures(t)
	store := gamepg.NewCardStore(f.db.Ent)
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)

	popular, quiet, bare := f.game(), f.game(), f.game()
	first := f.resource(popular, download.ResourceActive, createdAt(base), offering([]string{"win", "mac", "win"}, []string{"jp"}, 10))
	f.file(first, 100, download.FileInObjectStore)
	f.file(first, 5, download.FileInObjectStore)
	crowded := f.resource(popular, download.ResourceActive, createdAt(base.Add(48*time.Hour)), offering([]string{"and", "win"}, []string{"zh", "jp"}, 3))
	f.file(crowded, 700, download.FileInObjectStore)
	f.file(crowded, 50, download.FileOnServer)
	middle := f.resource(popular, download.ResourceActive, createdAt(base.Add(24*time.Hour)), offering([]string{"mac"}, []string{"zh-hant"}, 4))
	f.file(middle, 1, download.FileInObjectStore)
	tied := f.resource(popular, download.ResourceActive, createdAt(base.Add(48*time.Hour)), offering([]string{"lin"}, []string{"en"}, 0))
	f.file(tied, 300, download.FileInObjectStore)
	f.file(tied, 20, download.FileInObjectStore)
	f.file(tied, 4000, download.FileOnServer)
	removed := f.resource(popular, download.ResourceRemoved, createdAt(base.Add(72*time.Hour)), offering([]string{"ps4"}, []string{"en"}, 99))
	f.file(removed, 1000, download.FileInObjectStore)
	pending := f.resource(popular, download.ResourceActive, createdAt(base.Add(96*time.Hour)), offering([]string{"swi"}, []string{"en"}, 50))
	f.file(pending, 2000, download.FileOnServer)
	f.file(pending, 3000, download.FilePending)

	quietRemoved := f.resource(quiet, download.ResourceRemoved, offering([]string{"win"}, []string{"jp"}, 7))
	f.file(quietRemoved, 10, download.FileInObjectStore)
	quietPending := f.resource(quiet, download.ResourceActive, offering([]string{"win"}, []string{"jp"}, 7))
	f.file(quietPending, 10, download.FileOnServer)
	f.resource(quiet, download.ResourceActive, offering([]string{"win"}, []string{"jp"}, 7))

	cards, err := store.Cards(f.ctx, []int{popular, quiet, bare, 999999})
	if err != nil {
		t.Fatal(err)
	}
	byID := map[int]game.Card{}
	for _, card := range cards {
		byID[card.ID] = card
	}
	if len(cards) != 3 {
		t.Fatalf("one card per existing game: %+v", cards)
	}

	want := game.ResourceSummary{
		Count:     4,
		Downloads: 17,
		Platforms: []string{"mac", "win", "and", "lin"},
		Languages: []string{"jp", "en", "zh", "zh-hant"},
		Latest:    &game.LatestResource{At: base.Add(48 * time.Hour), Size: 320, Platforms: []string{"lin"}, Languages: []string{"en"}},
	}
	got := byID[popular].Resources
	if got.Latest == nil || !got.Latest.At.Equal(want.Latest.At) {
		t.Fatalf("latest is the newest public resource, the higher id on ties: %+v", got.Latest)
	}
	got.Latest.At = want.Latest.At
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("public resource summary\n got %+v %+v\nwant %+v %+v", got, got.Latest, want, want.Latest)
	}

	empty := game.ResourceSummary{Platforms: []string{}, Languages: []string{}}
	for _, id := range []int{quiet, bare} {
		if summary := byID[id].Resources; !reflect.DeepEqual(summary, empty) {
			t.Fatalf("game %d has no public resource: %+v", id, summary)
		}
	}
}

func TestCardsCarryTheTopThreeTags(t *testing.T) {
	f := newFixtures(t)
	store := gamepg.NewCardStore(f.db.Ent)
	tagged, other, bare := f.game(), f.game(), f.game()
	low := f.tag("low", 1, tagged)
	tieFirst := f.tag("tie-first", 5, tagged)
	top := f.tag("top", 9, tagged)
	tieSecond := f.tag("tie-second", 5, tagged, other)
	elsewhere := f.tag("elsewhere", 20, other)

	cards, err := store.Cards(f.ctx, []int{tagged, other, bare})
	if err != nil {
		t.Fatal(err)
	}
	byID := map[int][]game.TagRef{}
	for _, card := range cards {
		byID[card.ID] = card.Tags
	}
	if want := []game.TagRef{{ID: top, Name: "top"}, {ID: tieFirst, Name: "tie-first"}, {ID: tieSecond, Name: "tie-second"}}; !reflect.DeepEqual(byID[tagged], want) {
		t.Fatalf("top three tags by count then id (low %d dropped): %+v", low, byID[tagged])
	}
	if want := []game.TagRef{{ID: elsewhere, Name: "elsewhere"}, {ID: tieSecond, Name: "tie-second"}}; !reflect.DeepEqual(byID[other], want) {
		t.Fatalf("tags of another game: %+v", byID[other])
	}
	if tags, ok := byID[bare]; !ok || tags == nil || len(tags) != 0 {
		t.Fatalf("untagged games carry an empty list: %#v", tags)
	}
}

func TestCardsOfNoGames(t *testing.T) {
	f := newFixtures(t)
	cards, err := gamepg.NewCardStore(f.db.Ent).Cards(f.ctx, []int{999999})
	if err != nil || cards == nil || len(cards) != 0 {
		t.Fatalf("missing games: %#v %v", cards, err)
	}
	exists, err := gamepg.NewCardStore(f.db.Ent).Exists(f.ctx, f.game())
	if err != nil || !exists {
		t.Fatalf("exists: %v %v", exists, err)
	}
}
