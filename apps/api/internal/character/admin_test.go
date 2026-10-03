package character_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/character/charactertest"
)

func TestAdminSearchNormalizesTheFilter(t *testing.T) {
	store := &charactertest.AdminStore{Entries: []character.AdminEntry{{ID: 1, NameJP: "穹", GamesCount: 2}}, Total: 1}
	service := character.NewAdminService(store)

	entries, total, err := service.Search(context.Background(), character.AdminFilter{Search: "  sora  "}, character.Page{Number: 2, Size: 5})
	if err != nil || total != 1 || len(entries) != 1 || entries[0].GamesCount != 2 {
		t.Fatalf("search: %v %d %v", entries, total, err)
	}
	filter, page := store.Last()
	if filter.Search != "sora" || filter.SortBy != character.SortByID || page != (character.Page{Number: 2, Size: 5}) {
		t.Fatalf("filter %+v page %+v", filter, page)
	}

	if _, _, err := service.Search(context.Background(), character.AdminFilter{SortBy: character.SortByName, Descending: true}, character.Page{Number: 1, Size: 10}); err != nil {
		t.Fatal(err)
	}
	if filter, _ := store.Last(); filter.SortBy != character.SortByName || !filter.Descending {
		t.Fatalf("explicit sort kept: %+v", filter)
	}
}
