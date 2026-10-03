package moderationpg_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
)

var commentStatuses = map[string]comment.Status{
	moderationtest.CommentVisible: comment.StatusVisible,
	moderationtest.CommentPending: comment.StatusPending,
	moderationtest.CommentBlocked: comment.StatusBlocked,
}

func TestRepositoryContract(t *testing.T) {
	moderationtest.RepositoryContract(t, func(t *testing.T) moderationtest.Env {
		db := pgtest.New(t)
		ctx := context.Background()
		newUser, newGame := db.User, db.Game
		gameTitles := func(id int) moderation.GameTitles {
			row := db.Ent.Game.GetX(ctx, id)
			return moderation.GameTitles{JP: row.TitleJp, ZH: row.TitleZh, EN: row.TitleEn}
		}
		return moderationtest.Env{
			Repo: moderationpg.NewRepository(db.Ent),
			NewComment: func(t *testing.T, fixture moderationtest.CommentFixture) moderation.CommentSubject {
				creator, gameID := newUser(t), newGame(t, func(c *ent.GameCreate) { c.SetTitleZh("中文").SetTitleEn("English") })
				if fixture.ParentID != nil {
					gameID = db.Ent.Comment.GetX(ctx, *fixture.ParentID).GameID
				}
				row, err := db.Ent.Comment.Create().
					SetContent(json.RawMessage(`{}`)).
					SetHTML(fixture.HTML).
					SetGameID(gameID).
					SetCreatorID(creator).
					SetNillableParentID(fixture.ParentID).
					SetStatus(int(commentStatuses[fixture.Status])).
					Save(ctx)
				if err != nil {
					t.Fatal(err)
				}
				return moderation.CommentSubject{ID: row.ID, CreatorID: creator, GameID: gameID, HTML: fixture.HTML, ParentID: fixture.ParentID, Game: gameTitles(gameID)}
			},
			CommentStatus: func(t *testing.T, id int) string {
				status := comment.Status(db.Ent.Comment.GetX(ctx, id).Status)
				for name, value := range commentStatuses {
					if value == status {
						return name
					}
				}
				return ""
			},
			NewWalkthrough: func(t *testing.T, status string) moderation.WalkthroughSubject {
				creator, gameID := newUser(t), newGame(t)
				row, err := db.Ent.Walkthrough.Create().
					SetGameID(gameID).
					SetCreatorID(creator).
					SetTitle("guide").
					SetContent(json.RawMessage(`{}`)).
					SetHTML("<p>guide</p>").
					SetStatus(entwalkthrough.Status(status)).
					Save(ctx)
				if err != nil {
					t.Fatal(err)
				}
				return moderation.WalkthroughSubject{ID: row.ID, CreatorID: creator, GameID: gameID, Title: "guide", HTML: "<p>guide</p>", Game: gameTitles(gameID)}
			},
			WalkthroughStatus: func(t *testing.T, id int) string {
				return string(db.Ent.Walkthrough.GetX(ctx, id).Status)
			},
			EventCount: func(t *testing.T) int {
				return db.Ent.ModerationEvent.Query().CountX(ctx)
			},
		}
	})
}

func TestEventsRoundTrip(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	repo := moderationpg.NewRepository(db.Ent)
	newUser, newGame := db.User, db.Game
	creator, gameID := newUser(t), newGame(t)
	row := db.Ent.Comment.Create().SetContent(json.RawMessage(`{}`)).SetHTML("<p>x</p>").SetGameID(gameID).SetCreatorID(creator).SaveX(ctx)
	score := 0.123456
	if err := repo.RecordEvent(ctx, moderation.NewEvent{
		CommentID:   &row.ID,
		Auditor:     moderation.AuditorScreening,
		Model:       "omni-moderation-latest",
		Decision:    moderation.DecisionReview,
		TopCategory: moderation.CategoryHate,
		Categories:  json.RawMessage(`{"hate":false}`),
		Scores:      json.RawMessage(`{"hate":0.123456}`),
		MaxScore:    &score,
	}); err != nil {
		t.Fatal(err)
	}
	stored := moderationpg.ToEvent(db.Ent.ModerationEvent.Query().OnlyX(ctx))
	if stored.Auditor != moderation.AuditorScreening || stored.Decision != moderation.DecisionReview || stored.TopCategory != moderation.CategoryHate ||
		stored.MaxScore == nil || *stored.MaxScore != 0.12346 || stored.Reason != nil || string(stored.Categories) != `{"hate": false}` || stored.Created.IsZero() {
		t.Fatalf("unexpected stored event %+v", stored)
	}
}
