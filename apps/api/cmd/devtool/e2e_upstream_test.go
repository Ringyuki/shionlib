package main

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/nextmoe"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func TestTheStandInListsPatchesForOneSeededGameOnly(t *testing.T) {
	server := httptest.NewServer(e2eUpstream())
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL, "e2e")

	ctx := context.Background()
	works, err := client.Works(ctx, []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v900005"}, {Source: moyu.SourceBangumi, ID: "900005"}})
	if err != nil || len(works) != 1 {
		t.Fatalf("the seeded game is filed under one work: %v %v", works, err)
	}
	if only, err := client.Entries(ctx, "v900005", nil); err != nil || len(only) != 0 {
		t.Fatalf("its page is found through the work, not the vndb id: %+v %v", only, err)
	}
	entries, err := client.Entries(ctx, "v900005", works)
	if err != nil || len(entries) != 5 {
		t.Fatalf("every entry of the stand-in is one the adapter keeps: %+v %v", entries, err)
	}
	saves, translations := 0, 0
	for _, entry := range entries {
		if entry.Kind == moyu.KindSave {
			saves++
		}
		if entry.Translation != nil {
			translations++
		}
	}
	if saves != 1 || translations != 3 {
		t.Fatalf("one file of saved games and three translations: %d %d", saves, translations)
	}
	other, err := client.Works(ctx, []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v53590"}, {Source: moyu.SourceBangumi, ID: "524427"}})
	if err != nil || len(other) != 0 {
		t.Fatalf("other games are filed under no work: %v %v", other, err)
	}
	none, err := client.Entries(ctx, "v53590", other)
	if err != nil || len(none) != 0 {
		t.Fatalf("other games have no entries: %+v %v", none, err)
	}
	data, err := loadE2EDataset()
	if err != nil {
		t.Fatal(err)
	}
	var seeded bool
	for _, game := range data.Games {
		seeded = seeded || (game.VID != nil && "vndb:"+*game.VID == e2ePatchedGameRef)
	}
	if !seeded {
		t.Fatalf("the game the stand-in answers for is in the dataset: %s", e2ePatchedGameRef)
	}
}
