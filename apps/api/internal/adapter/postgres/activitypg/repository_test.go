package activitypg_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/activitypg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type fixture struct {
	t    *testing.T
	ctx  context.Context
	db   *pgtest.DB
	repo *activitypg.Repository
	user int
}

func newFixture(t *testing.T) fixture {
	db := pgtest.New(t)
	return fixture{t: t, ctx: context.Background(), db: db, repo: activitypg.NewRepository(db.Ent), user: db.User(t)}
}

func (f fixture) record(in activity.NewActivity) {
	f.t.Helper()
	in.UserID = f.user
	if err := f.repo.Create(f.ctx, in); err != nil {
		f.t.Fatal(err)
	}
}

func (f fixture) file(gameID, fileStatus int, published bool) (resourceID, fileID int) {
	f.t.Helper()
	create := f.db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(f.user).SetStatus(download.ResourceActive)
	if published {
		create.SetPublishedAt(time.Now())
	}
	resourceID = create.SaveX(f.ctx).ID
	fileID = f.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resourceID).
		SetType(download.FileTypeObjectStore).
		SetFileName("game.7z").
		SetFileSize(42).
		SetFileHash("hash").
		SetFileStatus(fileStatus).
		SetCreatorID(f.user).
		SaveX(f.ctx).ID
	return resourceID, fileID
}

func (f fixture) comment(gameID int, status comment.Status) int {
	f.t.Helper()
	return f.db.Ent.Comment.Create().SetGameID(gameID).SetCreatorID(f.user).SetContent([]byte(`{}`)).SetText("hi").SetStatus(int(status)).SaveX(f.ctx).ID
}

func (f fixture) walkthrough(gameID int, status entwalkthrough.Status) int {
	f.t.Helper()
	return f.db.Ent.Walkthrough.Create().SetGameID(gameID).SetCreatorID(f.user).SetText("guide").SetStatus(status).SaveX(f.ctx).ID
}

func (f fixture) list(filter activity.Filter, page activity.Page) ([]activity.Entry, int) {
	f.t.Helper()
	entries, total, err := f.repo.List(f.ctx, filter, page)
	if err != nil {
		f.t.Fatal(err)
	}
	return entries, total
}

func TestFeedHoldsWhatIsPublicNow(t *testing.T) {
	f := newFixture(t)
	gameID := f.db.Game(t)
	everything := activity.Filter{Types: activity.FeedTypes()}
	page := activity.Page{Number: 1, Size: 20}

	resourceID, stored := f.file(gameID, download.FileInObjectStore, true)
	_, onServer := f.file(gameID, download.FileOnServer, true)
	_, unpublished := f.file(gameID, download.FileInObjectStore, false)
	accepted, pending := f.comment(gameID, comment.StatusVisible), f.comment(gameID, comment.StatusPending)
	published, draft := f.walkthrough(gameID, entwalkthrough.StatusPUBLISHED), f.walkthrough(f.db.Game(t), entwalkthrough.StatusDRAFT)

	f.record(activity.NewActivity{Type: activity.TypeFileUploadToServer, GameID: &gameID, FileID: &stored})
	f.record(activity.NewActivity{Type: activity.TypeFileCheckOK, GameID: &gameID, FileID: &stored})
	f.record(activity.NewActivity{Type: activity.TypeGameCreate, GameID: &gameID})
	f.record(activity.NewActivity{Type: activity.TypeFileUploadToS3, GameID: &gameID, FileID: &stored})
	f.record(activity.NewActivity{Type: activity.TypeFileUploadToS3, GameID: &gameID, FileID: &onServer})
	f.record(activity.NewActivity{Type: activity.TypeFileUploadToS3, GameID: &gameID, FileID: &unpublished})
	f.record(activity.NewActivity{Type: activity.TypeComment, GameID: &gameID, CommentID: &accepted})
	f.record(activity.NewActivity{Type: activity.TypeComment, GameID: &gameID, CommentID: &pending})
	f.record(activity.NewActivity{Type: activity.TypeWalkthroughCreate, GameID: &gameID, WalkthroughID: &draft})
	f.record(activity.NewActivity{Type: activity.TypeWalkthroughCreate, GameID: &gameID, WalkthroughID: &published})

	entries, total := f.list(everything, page)
	if total != 3 || len(entries) != 3 {
		t.Fatalf("only a stored file of a published resource, an accepted comment and a published walkthrough belong in the feed: total=%d %+v", total, entries)
	}
	newest, comments, files := entries[0], entries[1], entries[2]
	if newest.Type != activity.TypeWalkthroughCreate || newest.Walkthrough == nil || newest.Walkthrough.ID != published || newest.User.ID != f.user {
		t.Fatalf("walkthrough entry: %+v", newest)
	}
	if comments.Type != activity.TypeComment || comments.Comment == nil || comments.Comment.ID != accepted {
		t.Fatalf("comment entry: %+v", comments)
	}
	if files.Type != activity.TypeFileUploadToS3 || files.File == nil || files.File.ID != stored || files.File.ResourceID != resourceID || files.File.FileName != "game.7z" || files.File.FileSize != 42 || files.GameID == nil || *files.GameID != gameID {
		t.Fatalf("file entry: %+v %+v", files, files.File)
	}

	onlyFiles, total := f.list(activity.Filter{Types: activity.CategoryFiles.Types()}, page)
	if total != 1 || onlyFiles[0].Type != activity.TypeFileUploadToS3 {
		t.Fatalf("category filter: %d %+v", total, onlyFiles)
	}
	second, total := f.list(everything, activity.Page{Number: 2, Size: 2})
	if total != 3 || len(second) != 1 || second[0].Type != activity.TypeFileUploadToS3 {
		t.Fatalf("pagination: %d %+v", total, second)
	}

	f.db.Ent.Comment.UpdateOneID(accepted).SetStatus(int(comment.StatusBlocked)).ExecX(f.ctx)
	f.db.Ent.Walkthrough.UpdateOneID(published).SetStatus(entwalkthrough.StatusHIDDEN).ExecX(f.ctx)
	f.db.Ent.GameDownloadResource.UpdateOneID(resourceID).SetStatus(download.ResourceActive + 1).ExecX(f.ctx)
	if _, total := f.list(everything, page); total != 0 {
		t.Fatalf("what stops being public leaves the feed: %d", total)
	}
}

func TestFeedFollowsTheVisibilityOfGames(t *testing.T) {
	f := newFixture(t)
	safe := f.db.Game(t)
	hidden := f.db.Game(t, func(c *ent.GameCreate) { c.SetStatus(2) })
	nsfw := f.db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	ratedCover := f.db.Game(t)
	if err := f.db.Ent.GameCover.Create().SetGameID(ratedCover).SetLanguage("jp").SetURL("x").SetType("dig").SetSexual(2).SetViolence(0).Exec(f.ctx); err != nil {
		t.Fatal(err)
	}
	for _, gameID := range []int{safe, hidden, nsfw, ratedCover} {
		commentID := f.comment(gameID, comment.StatusVisible)
		f.record(activity.NewActivity{Type: activity.TypeComment, GameID: &gameID, CommentID: &commentID})
	}
	page := activity.Page{Number: 1, Size: 10}

	if _, total := f.list(activity.Filter{Types: activity.FeedTypes()}, page); total != 3 {
		t.Fatalf("a hidden game takes its happenings out of the feed: %d", total)
	}
	strict, total := f.list(activity.Filter{Types: activity.FeedTypes(), ExcludeRated: true}, page)
	if total != 1 || strict[0].GameID == nil || *strict[0].GameID != safe {
		t.Fatalf("strict viewers only see happenings of safe games: %d %+v", total, strict)
	}
}
