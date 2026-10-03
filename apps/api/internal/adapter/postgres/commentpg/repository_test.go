package commentpg_test

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/commentpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entactivity "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/activity"
	entmessage "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/moderationevent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment/commenttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

func TestRepositoryContract(t *testing.T) {
	commenttest.RepositoryContract(t, func(t *testing.T) commenttest.Env {
		db := pgtest.New(t)
		return commenttest.Env{
			Repo:         commentpg.NewRepository(db.Ent),
			NewUser:      db.User,
			NewGame:      func(t *testing.T) int { return db.Game(t) },
			NewRatedGame: func(t *testing.T) int { return db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) }) },
		}
	})
}

func TestAdminStore(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	repo := commentpg.NewRepository(db.Ent)
	author, other := db.User(t), db.User(t)
	authorRow := db.Ent.User.GetX(ctx, author)
	gameID := db.Game(t, func(c *ent.GameCreate) { c.SetTitleZh("中文标题") })
	content := json.RawMessage(`{"root":{"type":"root","children":[]}}`)

	parent, err := repo.Create(ctx, comment.NewComment{Content: content, HTML: "<p>parent</p>", GameID: gameID, CreatorID: other})
	if err != nil {
		t.Fatal(err)
	}
	reply, err := repo.Create(ctx, comment.NewComment{Content: content, HTML: "<p>needle reply</p>", GameID: gameID, CreatorID: author, ParentID: &parent.ID, RootID: &parent.ID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.AddLike(ctx, reply.ID, other); err != nil {
		t.Fatal(err)
	}
	for i, decision := range []moderationevent.Decision{moderationevent.DecisionREVIEW, moderationevent.DecisionBLOCK} {
		db.Ent.ModerationEvent.Create().
			SetCommentID(reply.ID).
			SetAuditBy(i + 1).
			SetDecision(decision).
			SetTopCategory(moderationevent.TopCategoryHATE).
			SetCategoriesJSON(json.RawMessage(`{}`)).
			SetModel("model").
			ExecX(ctx)
	}

	page := comment.Page{Number: 1, Size: 10}
	cases := []struct {
		name   string
		filter comment.AdminFilter
		want   []int
	}{
		{"html", comment.AdminFilter{Search: "NEEDLE"}, []int{reply.ID}},
		{"creator name", comment.AdminFilter{Search: authorRow.Name}, []int{reply.ID}},
		{"creator email", comment.AdminFilter{Search: authorRow.Email}, []int{reply.ID}},
		{"game title", comment.AdminFilter{Search: "中文", SortBy: comment.SortByID}, []int{parent.ID, reply.ID}},
		{"oversized numbers are text", comment.AdminFilter{Search: "99999999999999"}, nil},
		{"status", comment.AdminFilter{Status: ptr(comment.StatusPending), CreatorID: &author}, []int{reply.ID}},
		{"game and order", comment.AdminFilter{GameID: &gameID, SortBy: comment.SortByID, Descending: true}, []int{reply.ID, parent.ID}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			entries, total, err := repo.Search(ctx, c.filter, page)
			if err != nil {
				t.Fatal(err)
			}
			got := make([]int, len(entries))
			for i, entry := range entries {
				got[i] = entry.ID
			}
			if total != len(c.want) || len(got) != len(c.want) || (len(got) > 0 && got[0] != c.want[0]) {
				t.Fatalf("got %v (total %d), want %v", got, total, c.want)
			}
		})
	}

	numeric, _, err := repo.Search(ctx, comment.AdminFilter{Search: itoa(reply.ID), SortBy: comment.SortByID}, page)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.ContainsFunc(numeric, func(e comment.AdminEntry) bool { return e.ID == reply.ID }) {
		t.Fatalf("numeric keywords match ids: %+v", numeric)
	}

	entries, _, _ := repo.Search(ctx, comment.AdminFilter{Search: "needle"}, page)
	entry := entries[0]
	if entry.CreatorEmail != authorRow.Email || entry.Creator.ID != author || entry.Game.TitleZH != "中文标题" || entry.LikeCount != 1 ||
		entry.Parent == nil || entry.Parent.Creator.ID != other || entry.Moderation == nil || entry.Moderation.Decision != moderation.DecisionBlock || entry.Content != nil {
		t.Fatalf("unexpected admin entry %+v", entry)
	}
	detail, err := repo.Detail(ctx, reply.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(detail.Moderations) != 2 || detail.Moderations[0].Decision != moderation.DecisionBlock || detail.Moderations[1].Auditor != moderation.AuditorScreening || detail.Content == nil {
		t.Fatalf("unexpected detail %+v", detail)
	}
	if _, err := repo.Detail(ctx, 987654); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("missing detail: %v", err)
	}

	if has, err := repo.HasActivity(ctx, reply.ID); err != nil || has {
		t.Fatalf("no activity yet: %v %v", has, err)
	}
	db.Ent.Activity.Create().SetType(entactivity.TypeCOMMENT).SetUserID(author).SetCommentID(reply.ID).SetGameID(gameID).ExecX(ctx)
	if has, err := repo.HasActivity(ctx, reply.ID); err != nil || !has {
		t.Fatalf("activity recorded: %v %v", has, err)
	}
	if has, err := repo.HasReplyNotice(ctx, reply.ID, other); err != nil || has {
		t.Fatalf("no notice yet: %v %v", has, err)
	}
	db.Ent.Message.Create().SetType(entmessage.TypeCOMMENT_REPLY).SetTone(entmessage.ToneINFO).SetTitle("t").SetContent("c").SetCommentID(reply.ID).SetReceiverID(other).ExecX(ctx)
	if has, err := repo.HasReplyNotice(ctx, reply.ID, other); err != nil || !has {
		t.Fatalf("notice recorded: %v %v", has, err)
	}
}

func ptr[T any](v T) *T {
	return &v
}

func itoa(v int) string {
	raw, _ := json.Marshal(v)
	return string(raw)
}
