package open_test

import (
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/open"
	"github.com/Ringyuki/shionlib/apps/api/internal/open/opentest"
)

func ptr[T any](v T) *T {
	return &v
}

func newService() (*open.Service, *opentest.Resources) {
	games := &opentest.Games{List: []open.Game{
		{ID: 1947, HID: ptr(2303), BID: ptr("7868"), VID: ptr("v1141"), TitleJP: "俺たちに翼はない"},
		{ID: 11110, HID: ptr(2305), BID: ptr("15004"), VID: ptr("v1141"), TitleJP: "俺たちに翼はない R"},
		{ID: 1301, HID: ptr(1400), BID: ptr("1167"), VID: ptr("v10"), TitleJP: "narcissu"},
	}}
	resources := &opentest.Resources{ByGame: map[int][]download.GameResource{1947: {{Resource: download.Resource{ID: 3443, GameID: 1947}}}}}
	return open.NewService(games, resources), resources
}

func ids(result open.Result) []int {
	out := make([]int, len(result.Games))
	for i, game := range result.Games {
		out[i] = game.ID
	}
	return out
}

func TestLookupFindsEveryGameOfAnIDInTheOrderAsked(t *testing.T) {
	service, resources := newService()
	result, err := service.Lookup(t.Context(), open.KindVID, "10, 1141,v99999,V1141")
	if err != nil {
		t.Fatal(err)
	}
	if got := ids(result); len(got) != 3 || got[0] != 1301 || got[1] != 1947 || got[2] != 11110 {
		t.Fatalf("games in the order asked, a shared ID by game ID: %v", got)
	}
	if len(result.Missing) != 1 || result.Missing[0] != "v99999" {
		t.Fatalf("missing as written: %v", result.Missing)
	}
	if len(result.Games[1].Resources) != 1 || result.Games[0].Resources != nil || len(resources.Asked) != 1 || len(resources.Asked[0]) != 3 {
		t.Fatalf("resources are read once for every game found: %+v %v", result.Games, resources.Asked)
	}
}

func TestLookupReadsEachKindOfID(t *testing.T) {
	service, _ := newService()
	for kind, raw := range map[open.Kind]string{open.KindID: "1947", open.KindHID: "2303", open.KindBID: "7868"} {
		result, err := service.Lookup(t.Context(), kind, raw)
		if err != nil || len(result.Games) != 1 || result.Games[0].ID != 1947 {
			t.Fatalf("%s: %+v %v", kind, result, err)
		}
	}
	result, err := service.Lookup(t.Context(), open.KindBID, "999")
	if err != nil || len(result.Games) != 0 || len(result.Missing) != 1 {
		t.Fatalf("nothing found is not an error: %+v %v", result, err)
	}
}

func TestLookupRefusesWhatIsNotAnIDOrTooMany(t *testing.T) {
	service, _ := newService()
	for kind, raw := range map[open.Kind]string{open.KindID: "abc", open.KindHID: "0", open.KindBID: "00", open.KindVID: "r123"} {
		if _, err := service.Lookup(t.Context(), kind, raw); !errors.Is(err, open.ErrBadValue) {
			t.Fatalf("%s %q: %v", kind, raw, err)
		}
	}
	if _, err := service.Lookup(t.Context(), open.KindID, " , "); !errors.Is(err, open.ErrOneKind) {
		t.Fatalf("no ID at all: %v", err)
	}
	many := make([]string, open.MaxValues+1)
	for i := range many {
		many[i] = strconv.Itoa(i + 1)
	}
	if _, err := service.Lookup(t.Context(), open.KindID, strings.Join(many, ",")); !errors.Is(err, open.ErrTooManyValues) {
		t.Fatalf("too many: %v", err)
	}
}
