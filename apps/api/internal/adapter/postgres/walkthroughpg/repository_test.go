package walkthroughpg_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/moderationevent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/walkthroughpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough/walkthroughtest"
)

func TestRepositoryContract(t *testing.T) {
	walkthroughtest.RepositoryContract(t, func(t *testing.T) walkthroughtest.Env {
		db := pgtest.New(t)
		return walkthroughtest.Env{
			Repo:         walkthroughpg.NewRepository(db.Ent),
			NewUser:      db.User,
			NewGame:      func(t *testing.T) int { return db.Game(t) },
			NewRatedGame: func(t *testing.T) int { return db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) }) },
		}
	})
}

func TestAdminStore(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	repo := walkthroughpg.NewRepository(db.Ent)
	author := db.User(t)
	authorRow := db.Ent.User.GetX(ctx, author)
	gameID := db.Game(t, func(c *ent.GameCreate) { c.SetTitleEn("English Title") })
	content := json.RawMessage(`{"root":{"type":"root","children":[]}}`)

	first, err := repo.Create(ctx, walkthrough.NewWalkthrough{GameID: gameID, Title: "Alpha route", Content: content, HTML: "<p>alpha</p>", Status: walkthrough.StatusPublished, CreatorID: author})
	if err != nil {
		t.Fatal(err)
	}
	second, err := repo.Create(ctx, walkthrough.NewWalkthrough{GameID: gameID, Title: "Beta route", Content: content, HTML: "<p>needle</p>", Status: walkthrough.StatusHidden, CreatorID: author})
	if err != nil {
		t.Fatal(err)
	}
	db.Ent.ModerationEvent.Create().SetWalkthroughID(second.ID).SetAuditBy(2).SetDecision(moderationevent.DecisionBLOCK).
		SetTopCategory(moderationevent.TopCategorySPAM).SetCategoriesJSON(json.RawMessage(`{}`)).SetModel("gpt-5-mini").SetReason("ads").ExecX(ctx)

	page := walkthrough.Page{Number: 1, Size: 10}
	hidden := walkthrough.StatusHidden
	cases := []struct {
		name   string
		filter walkthrough.AdminFilter
		want   []int
	}{
		{"title", walkthrough.AdminFilter{Search: "alpha"}, []int{first.ID}},
		{"html", walkthrough.AdminFilter{Search: "NEEDLE"}, []int{second.ID}},
		{"game title", walkthrough.AdminFilter{Search: "english", SortBy: walkthrough.SortByTitle}, []int{first.ID, second.ID}},
		{"creator email", walkthrough.AdminFilter{Search: authorRow.Email, SortBy: walkthrough.SortByID, Descending: true}, []int{second.ID, first.ID}},
		{"status", walkthrough.AdminFilter{Status: &hidden}, []int{second.ID}},
		{"game", walkthrough.AdminFilter{GameID: &gameID, CreatorID: &author, SortBy: walkthrough.SortByCreated}, []int{first.ID, second.ID}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			entries, total, err := repo.Search(ctx, c.filter, page)
			if err != nil {
				t.Fatal(err)
			}
			if total != len(c.want) || len(entries) != len(c.want) {
				t.Fatalf("got %d entries (total %d), want %v", len(entries), total, c.want)
			}
			for i, id := range c.want {
				if entries[i].ID != id {
					t.Fatalf("entry %d: got %d, want %d", i, entries[i].ID, id)
				}
			}
		})
	}
	entries, _, _ := repo.Search(ctx, walkthrough.AdminFilter{Search: "needle"}, page)
	entry := entries[0]
	if entry.CreatorEmail != authorRow.Email || entry.Game.TitleEN != "English Title" || entry.HTML != "<p>needle</p>" || entry.Content != nil ||
		entry.Moderation == nil || entry.Moderation.Decision != moderation.DecisionBlock || *entry.Moderation.Reason != "ads" {
		t.Fatalf("unexpected admin entry %+v", entry)
	}
	detail, err := repo.Detail(ctx, second.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(detail.Moderations) != 1 || detail.Content == nil || detail.Moderations[0].Auditor != moderation.AuditorReview {
		t.Fatalf("unexpected detail %+v", detail)
	}
	if _, err := repo.Detail(ctx, 987654); !errors.Is(err, walkthrough.ErrNotFound) {
		t.Fatalf("missing detail: %v", err)
	}
}
