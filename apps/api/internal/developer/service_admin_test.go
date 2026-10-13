package developer_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer/developertest"
)

func TestAdminSearchNormalizesTheFilter(t *testing.T) {
	store := &developertest.AdminStore{Entries: []developer.AdminEntry{{ID: 1, Name: "Yuzusoft", GamesCount: 3}}, Total: 1}
	service := developer.NewAdminService(store)

	entries, total, err := service.Search(context.Background(), developer.AdminFilter{Search: "\tyuzu "}, developer.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || len(entries) != 1 || entries[0].GamesCount != 3 {
		t.Fatalf("search: %v %d %v", entries, total, err)
	}
	filter, page := store.Last()
	if filter.Search != "yuzu" || filter.SortBy != developer.SortByID || page != (developer.Page{Number: 1, Size: 10}) {
		t.Fatalf("filter %+v page %+v", filter, page)
	}

	if _, _, err := service.Search(context.Background(), developer.AdminFilter{SortBy: developer.SortByUpdated}, developer.Page{Number: 1, Size: 10}); err != nil {
		t.Fatal(err)
	}
	if filter, _ := store.Last(); filter.SortBy != developer.SortByUpdated || filter.Descending {
		t.Fatalf("explicit sort kept: %+v", filter)
	}
}
