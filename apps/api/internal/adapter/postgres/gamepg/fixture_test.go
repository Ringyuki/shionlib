package gamepg_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type fixtures struct {
	t   *testing.T
	db  *pgtest.DB
	ctx context.Context
}

func newFixtures(t *testing.T) fixtures {
	return fixtures{t: t, db: pgtest.New(t), ctx: context.Background()}
}

func (f fixtures) game(mutate ...func(*ent.GameCreate)) int {
	f.t.Helper()
	return f.db.Game(f.t, mutate...)
}

func (f fixtures) cover(gameID, sexual int) {
	f.t.Helper()
	if err := f.db.Ent.GameCover.Create().SetGameID(gameID).SetLanguage("jp").SetType("pkgfront").SetURL("c.webp").SetDims(pgvalue.Ints{1, 2}).SetSexual(sexual).SetViolence(0).Exec(f.ctx); err != nil {
		f.t.Fatal(err)
	}
}

func (f fixtures) resource(gameID, status int, mutate ...func(*ent.GameDownloadResourceCreate)) int {
	f.t.Helper()
	create := f.db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(f.db.User(f.t)).SetStatus(status).SetPublishedAt(time.Now())
	for _, fn := range mutate {
		fn(create)
	}
	row, err := create.Save(f.ctx)
	if err != nil {
		f.t.Fatal(err)
	}
	return row.ID
}

func (f fixtures) file(resourceID int, size int64, status int) {
	f.t.Helper()
	existing := f.db.Ent.GameDownloadResourceFile.Query().Where(gamedownloadresourcefile.GameDownloadResourceID(resourceID)).CountX(f.ctx)
	err := f.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resourceID).
		SetType(download.FileTypeObjectStore).
		SetFileName(fmt.Sprintf("game-%d.7z", existing+1)).
		SetFileSize(size).
		SetFileHash("hash").
		SetFileStatus(status).
		SetCreatorID(f.db.User(f.t)).
		Exec(f.ctx)
	if err != nil {
		f.t.Fatal(err)
	}
}

func (f fixtures) published(gameID int, at time.Time) int {
	f.t.Helper()
	id := f.resource(gameID, download.ResourceActive, createdAt(at))
	f.file(id, 1, download.FileInObjectStore)
	return id
}

func (f fixtures) tag(name string, count int, gameIDs ...int) int {
	f.t.Helper()
	row, err := f.db.Ent.Tag.Create().SetName(name).SetCount(count).SetAliases(pgvalue.Strings{name + "-alias"}).Save(f.ctx)
	if err != nil {
		f.t.Fatal(err)
	}
	for _, id := range gameIDs {
		if err := f.db.Ent.GameTagRelation.Create().SetGameID(id).SetTagID(row.ID).Exec(f.ctx); err != nil {
			f.t.Fatal(err)
		}
	}
	return row.ID
}

func (f fixtures) developer(name string) int {
	f.t.Helper()
	row, err := f.db.Ent.GameDeveloper.Create().SetName(name).SetAliases(pgvalue.Strings{name + " alias"}).Save(f.ctx)
	if err != nil {
		f.t.Fatal(err)
	}
	return row.ID
}

func (f fixtures) credit(gameID, developerID int, role string) {
	f.t.Helper()
	if err := f.db.Ent.GameDeveloperRelation.Create().SetGameID(gameID).SetDeveloperID(developerID).SetRole(role).Exec(f.ctx); err != nil {
		f.t.Fatal(err)
	}
}

func (f fixtures) translator(name string) int {
	f.t.Helper()
	row, err := f.db.Ent.Translator.Create().SetName(name).SetNameKey(name).Save(f.ctx)
	if err != nil {
		f.t.Fatal(err)
	}
	return row.ID
}

func (f fixtures) translated(resourceID, translatorID int) {
	f.t.Helper()
	if err := f.db.Ent.GameDownloadResourceTranslator.Create().SetResourceID(resourceID).SetTranslatorID(translatorID).Exec(f.ctx); err != nil {
		f.t.Fatal(err)
	}
}

func ids(t *testing.T, got []int, err error) []int {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func date(year int, month time.Month) func(*ent.GameCreate) {
	return func(c *ent.GameCreate) { c.SetReleaseDate(time.Date(year, month, 10, 0, 0, 0, 0, time.UTC)) }
}

func createdAt(at time.Time) func(*ent.GameDownloadResourceCreate) {
	return func(c *ent.GameDownloadResourceCreate) { c.SetCreated(at) }
}

func offering(platforms, languages []string, downloads int) func(*ent.GameDownloadResourceCreate) {
	return func(c *ent.GameDownloadResourceCreate) {
		c.SetPlatform(pgvalue.Strings(platforms)).SetLanguage(pgvalue.Strings(languages)).SetDownloads(downloads)
	}
}

func unpublished(c *ent.GameDownloadResourceCreate) {
	c.Mutation().ClearPublishedAt()
}
