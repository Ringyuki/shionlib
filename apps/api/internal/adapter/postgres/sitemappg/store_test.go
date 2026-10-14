package sitemappg_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/sitemappg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
)

type fixture struct {
	db  *pgtest.DB
	ctx context.Context
}

var (
	published = time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	edited    = time.Date(2026, 10, 2, 3, 4, 5, 0, time.UTC)
)

func (f fixture) resource(t *testing.T, gameID int, check download.CheckStatus) int {
	t.Helper()
	creator := f.db.User(t)
	resource := f.db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(creator).SetPublishedAt(published).SaveX(f.ctx)
	f.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resource.ID).
		SetType(download.FileTypeObjectStore).
		SetFileName("game.7z").
		SetFileSize(1).
		SetFileHash("hash").
		SetFileStatus(download.FileInObjectStore).
		SetFileCheckStatus(int(check)).
		SetCreatorID(creator).
		SaveX(f.ctx)
	return resource.ID
}

func TestStoreListsPublicEntriesWithTheirLastChange(t *testing.T) {
	db := pgtest.New(t)
	f := fixture{db: db, ctx: context.Background()}
	bare := db.Game(t)
	adult := db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	db.Game(t, func(c *ent.GameCreate) { c.SetStatus(2) })
	resource := f.resource(t, adult, download.CheckOK)
	f.resource(t, adult, download.CheckHarmfulPendingReview)
	db.Ent.GameDownloadResourceEvent.Create().SetResourceID(resource).SetKind("edited").SetCreated(edited).ExecX(f.ctx)
	walkthrough := db.Ent.Walkthrough.Create().SetGameID(bare).SetCreatorID(db.User(t)).SetText("guide").SetStatus(entwalkthrough.StatusPUBLISHED).SetUpdated(published).SaveX(f.ctx).ID
	db.Ent.Walkthrough.Create().SetGameID(bare).SetCreatorID(db.User(t)).SetText("draft").SetStatus(entwalkthrough.StatusDRAFT).ExecX(f.ctx)
	credited := db.Ent.Translator.Create().SetName("组").SetNameKey("组").SaveX(f.ctx).ID
	db.Ent.Translator.Create().SetName("空").SetNameKey("空").ExecX(f.ctx)
	db.Ent.GameDownloadResourceTranslator.Create().SetResourceID(resource).SetTranslatorID(credited).ExecX(f.ctx)
	developer := db.Ent.GameDeveloper.Create().SetName("dev").SaveX(f.ctx).ID

	store := sitemappg.NewStore(db.Ent)
	for section, want := range map[sitemap.Section]int{sitemap.SectionGame: 2, sitemap.SectionResource: 1, sitemap.SectionWalkthrough: 1, sitemap.SectionDeveloper: 1, sitemap.SectionCharacter: 0, sitemap.SectionTranslator: 1} {
		if count, err := store.Count(f.ctx, section); err != nil || count != want {
			t.Fatalf("%s count: %d %v", section, count, err)
		}
	}
	games, err := store.Entries(f.ctx, sitemap.SectionGame, 0, 10)
	if err != nil || len(games) != 2 || games[0].ID != bare || games[0].Modified != nil || games[1].ID != adult || !games[1].Modified.Equal(edited) {
		t.Fatalf("games: %+v %v", games, err)
	}
	if second, err := store.Entries(f.ctx, sitemap.SectionGame, 1, 10); err != nil || len(second) != 1 || second[0].ID != adult {
		t.Fatalf("offset: %+v %v", second, err)
	}
	resources, err := store.Entries(f.ctx, sitemap.SectionResource, 0, 10)
	if err != nil || len(resources) != 1 || resources[0].ID != resource || resources[0].GameID != adult || !resources[0].Modified.Equal(edited) {
		t.Fatalf("resources: %+v %v", resources, err)
	}
	walkthroughs, err := store.Entries(f.ctx, sitemap.SectionWalkthrough, 0, 10)
	if err != nil || len(walkthroughs) != 1 || walkthroughs[0].ID != walkthrough || walkthroughs[0].GameID != bare || !walkthroughs[0].Modified.Equal(published) {
		t.Fatalf("walkthroughs: %+v %v", walkthroughs, err)
	}
	translators, err := store.Entries(f.ctx, sitemap.SectionTranslator, 0, 10)
	if err != nil || len(translators) != 1 || translators[0].ID != credited || translators[0].Modified != nil {
		t.Fatalf("translators: %+v %v", translators, err)
	}
	developers, err := store.Entries(f.ctx, sitemap.SectionDeveloper, 0, 10)
	if err != nil || len(developers) != 1 || developers[0].ID != developer {
		t.Fatalf("developers: %+v %v", developers, err)
	}
}
