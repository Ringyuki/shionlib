package friendlink_test

import (
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink/friendlinktest"
)

func newService() (*friendlink.Service, *friendlinktest.MemoryRepository) {
	repo := friendlinktest.NewMemoryRepository()
	return friendlink.NewService(repo, friendlinktest.Transactor{}), repo
}

func order(t *testing.T, service *friendlink.Service) []string {
	t.Helper()
	links, err := service.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	out := make([]string, len(links))
	for i, link := range links {
		out[i] = link.Name
	}
	return out
}

func TestCreateAppendsALinkAfterTheOthersWithoutSurroundingSpace(t *testing.T) {
	service, _ := newService()
	for _, name := range []string{"A", "B"} {
		if _, err := service.Create(t.Context(), friendlink.NewLink{Name: name, URL: "https://" + name + ".example", Visible: true}); err != nil {
			t.Fatal(err)
		}
	}
	created, err := service.Create(t.Context(), friendlink.NewLink{Name: "  C ", URL: " https://c.example ", Description: " 简介 ", Visible: true})
	if err != nil {
		t.Fatal(err)
	}
	if created.Name != "C" || created.URL != "https://c.example" || created.Description != "简介" || created.Position != 3 {
		t.Fatalf("unexpected link %+v", created)
	}
	if got := order(t, service); len(got) != 3 || got[2] != "C" {
		t.Fatalf("a new link goes last: %v", got)
	}
}

func TestReorderPutsLinksInTheGivenOrderOnlyWhenEveryLinkIsGiven(t *testing.T) {
	service, _ := newService()
	var ids []int
	for _, name := range []string{"A", "B", "C"} {
		link, err := service.Create(t.Context(), friendlink.NewLink{Name: name, URL: "https://" + name + ".example"})
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, link.ID)
	}
	if err := service.Reorder(t.Context(), []int{ids[2], ids[0], ids[1]}); err != nil {
		t.Fatal(err)
	}
	if got := order(t, service); got[0] != "C" || got[1] != "A" || got[2] != "B" {
		t.Fatalf("links follow the given order: %v", got)
	}
	for _, stale := range [][]int{{ids[0], ids[1]}, {ids[0], ids[1], ids[1]}, {ids[0], ids[1], ids[2], 99}} {
		if err := service.Reorder(t.Context(), stale); !errors.Is(err, friendlink.ErrStaleOrder) {
			t.Fatalf("an order that does not name every link once is refused: %v %v", stale, err)
		}
	}
	if got := order(t, service); got[0] != "C" || got[1] != "A" || got[2] != "B" {
		t.Fatalf("a refused order changes nothing: %v", got)
	}
}

func TestVisibleLeavesHiddenLinksOut(t *testing.T) {
	service, _ := newService()
	if _, err := service.Create(t.Context(), friendlink.NewLink{Name: "A", URL: "https://a.example", Visible: true}); err != nil {
		t.Fatal(err)
	}
	hidden, err := service.Create(t.Context(), friendlink.NewLink{Name: "B", URL: "https://b.example", Visible: true})
	if err != nil {
		t.Fatal(err)
	}
	off := false
	if _, err := service.Update(t.Context(), hidden.ID, friendlink.Changes{Visible: &off}); err != nil {
		t.Fatal(err)
	}
	visible, err := service.Visible(t.Context())
	if err != nil || len(visible) != 1 || visible[0].Name != "A" {
		t.Fatalf("only visible links are shown: %+v %v", visible, err)
	}
}
