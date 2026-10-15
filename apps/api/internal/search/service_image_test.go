package search_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/search/searchtest"
)

type imageFixture struct {
	finder     *searchtest.Finder
	recognizer *searchtest.Recognizer
	pictures   *searchtest.Pictures
	cache      *gametest.Cache
	service    *search.ImageService
}

func newImageFixture(sightings ...search.Sighting) imageFixture {
	f := imageFixture{
		finder: &searchtest.Finder{
			Games: map[string]game.Card{
				"千恋＊万花":    {ID: 1, TitleJP: "千恋＊万花"},
				"千恋＊万花 FD": {ID: 1, TitleJP: "千恋＊万花"},
			},
			Characters: map[string][]character.Summary{
				"レナ・リヒテナウアー": {
					{ID: 91, NameJP: "レナ", Game: &character.GameRef{ID: 2}},
					{ID: 92, NameJP: "レナ・リヒテナウアー", Game: &character.GameRef{ID: 1}},
				},
				"ムラサメ": {{ID: 93, NameJP: "ムラサメ博士", Game: &character.GameRef{ID: 3}}},
			},
		},
		recognizer: &searchtest.Recognizer{Sightings: sightings},
		pictures:   &searchtest.Pictures{},
		cache:      gametest.NewCache(),
	}
	f.service = search.NewImageService(search.ImageDeps{Finder: f.finder, Recognizer: f.recognizer, Pictures: f.pictures, Cache: f.cache})
	return f
}

func sighting(name, work string) search.Sighting {
	return search.Sighting{Box: search.Box{Left: 0.1, Top: 0.2, Right: 0.3, Bottom: 0.4}, Name: name, Work: work}
}

func TestImageSearchMatchesEverySightingToTheLibrary(t *testing.T) {
	unsure := sighting("ムラサメ", "千恋＊万花 FD")
	unsure.Unsure = true
	f := newImageFixture(sighting("レナ・リヒテナウアー", "千恋＊万花"), unsure, sighting("アトリ", "ATRI -My Dear Moments-"), sighting("", "千恋＊万花"))

	results, err := f.service.Search(context.Background(), permissive, []byte("picture"))
	if err != nil {
		t.Fatal(err)
	}
	if results.Source.Name != "Recognizer" || results.Source.URL != "https://recognizer.test/" {
		t.Fatalf("the recognizer is credited: %+v", results.Source)
	}
	if len(results.Games) != 1 || results.Games[0].ID != 1 {
		t.Fatalf("two works naming the same game list it once: %+v", results.Games)
	}
	if !slices.Equal(results.Unlisted, []string{"ATRI -My Dear Moments-"}) {
		t.Fatalf("works missing from the library are named: %v", results.Unlisted)
	}
	if len(results.Characters) != 4 {
		t.Fatalf("every sighting stays, in order: %+v", results.Characters)
	}
	rena, murasame, atri, nameless := results.Characters[0], results.Characters[1], results.Characters[2], results.Characters[3]
	if rena.GameID == nil || *rena.GameID != 1 || rena.Character == nil || rena.Character.ID != 92 || rena.Box != (search.Box{Left: 0.1, Top: 0.2, Right: 0.3, Bottom: 0.4}) {
		t.Fatalf("the character is the one in the matched game: %+v", rena)
	}
	if murasame.GameID == nil || *murasame.GameID != 1 || murasame.Character != nil || !murasame.Unsure {
		t.Fatalf("a namesake from another game is no match: %+v", murasame)
	}
	if atri.GameID != nil || atri.Character != nil || atri.Name != "アトリ" {
		t.Fatalf("a sighting outside the library keeps what was recognized: %+v", atri)
	}
	if nameless.GameID == nil || nameless.Character != nil {
		t.Fatalf("a sighting without a name still names its game: %+v", nameless)
	}
	for i, query := range f.finder.Queries {
		if slices.Equal(query.Kinds, []catalog.Entity{catalog.EntityGame}) && (query.Resources != game.ResourcesAny || query.Size != 1) {
			t.Fatalf("query %d: a work is matched to the first listed game, with or without resources: %+v", i, query)
		}
		if f.finder.Viewers[i] != permissive {
			t.Fatalf("query %d is made as the viewer: %+v", i, f.finder.Viewers[i])
		}
	}
	if !slices.Equal(f.pictures.Longest, []int{search.ImageLongestSide}) || len(f.recognizer.Images) != 1 || string(f.recognizer.Images[0]) != "shrunk:picture" {
		t.Fatalf("the recognizer gets the shrunk picture: %v %q", f.pictures.Longest, f.recognizer.Images)
	}
}

func TestImageSearchRemembersWhatEachPictureShows(t *testing.T) {
	f := newImageFixture(sighting("レナ・リヒテナウアー", "千恋＊万花"))
	ctx := context.Background()
	for range 2 {
		if results, err := f.service.Search(ctx, guest, []byte("picture")); err != nil || len(results.Characters) != 1 {
			t.Fatalf("%+v %v", results, err)
		}
	}
	if len(f.recognizer.Images) != 1 {
		t.Fatalf("the same picture is recognized once: %d", len(f.recognizer.Images))
	}
	for key, ttl := range f.cache.TTLs {
		if ttl != search.ImageCacheTTL {
			t.Fatalf("%s is kept for %s", key, ttl)
		}
	}
	f.recognizer.Sightings = nil
	if results, err := f.service.Search(ctx, guest, []byte("another")); err != nil || len(results.Characters) != 0 || results.Characters == nil {
		t.Fatalf("another picture is recognized on its own: %+v %v", results, err)
	}
	if len(f.recognizer.Images) != 2 {
		t.Fatalf("a new picture reaches the recognizer: %d", len(f.recognizer.Images))
	}
}

func TestImageSearchRefusesPicturesItCannotUse(t *testing.T) {
	ctx := context.Background()
	f := newImageFixture()
	if _, err := f.service.Search(ctx, guest, nil); !errors.Is(err, search.ErrImageMissing) {
		t.Fatalf("missing picture: %v", err)
	}
	if _, err := f.service.Search(ctx, guest, make([]byte, search.ImageMaxBytes+1)); !errors.Is(err, search.ErrImageTooLarge) {
		t.Fatalf("oversized picture: %v", err)
	}
	f.pictures.Err = errors.New("not an image")
	if _, err := f.service.Search(ctx, guest, []byte("text")); !errors.Is(err, search.ErrImageUnsupported) {
		t.Fatalf("unreadable picture: %v", err)
	}
	if len(f.recognizer.Images) != 0 {
		t.Fatalf("refused pictures never reach the recognizer: %d", len(f.recognizer.Images))
	}

	busy := newImageFixture()
	busy.recognizer.Err = search.ErrImageBusy
	if _, err := busy.service.Search(ctx, guest, []byte("picture")); !errors.Is(err, search.ErrImageBusy) {
		t.Fatalf("the recognizer's refusal passes through: %v", err)
	}
	if results, err := busy.service.Search(ctx, guest, []byte("picture")); !errors.Is(err, search.ErrImageBusy) {
		t.Fatalf("a refusal is not remembered: %+v %v", results, err)
	}

	unlisted := newImageFixture(sighting("レナ・リヒテナウアー", "千恋＊万花"))
	unlisted.finder.Err = errors.New("catalog down")
	if _, err := unlisted.service.Search(ctx, guest, []byte("picture")); err == nil {
		t.Fatal("a failing catalog fails the search")
	}
}
