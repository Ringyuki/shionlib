package downloadpg_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/downloadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

var _ download.LegacyStore = (*downloadpg.LegacyStore)(nil)

func TestLegacyStoreListsResourcesWithTheirNamesAndDiscs(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := downloadpg.NewLegacyStore(f.db.Ent)
	creator, gameID := f.db.User(t), f.db.Game(t)
	first := f.resource(t, gameID, creator, func(c *ent.GameDownloadResourceCreate) {
		c.SetLanguage(pgvalue.Strings{"zh"}).SetNote(paragraph("绿茶汉化组")).SetNoteText("绿茶汉化组").SetUndescribed(true)
	})
	f.resource(t, gameID, creator)
	f.file(t, first.ID, creator, "game.part1.rar")
	f.file(t, first.ID, creator, "game.part2.rar")
	f.db.Ent.Inspection.Create().SetResourceID(first.ID).SetStatus("ready").SetDiscCount(2).SaveX(ctx)
	second := f.resource(t, gameID, creator, func(c *ent.GameDownloadResourceCreate) {
		c.SetTranslation(string(download.TranslationNone)).SetForm(string(download.FormPortable)).SetUndescribed(true)
	})
	f.db.Ent.Inspection.Create().SetResourceID(second.ID).SetStatus("ready").SaveX(ctx)
	third := f.resource(t, gameID, creator, func(c *ent.GameDownloadResourceCreate) { c.SetUndescribed(true) })

	listed, err := store.ListUndescribed(ctx, 0, 2)
	if err != nil || len(listed) != 2 || listed[0].ID != first.ID || listed[1].ID != second.ID {
		t.Fatalf("listed %+v %v", listed, err)
	}
	if got := listed[0]; got.CreatorID != creator || !slices.Equal(got.Languages, []string{"zh"}) || *got.Note != "绿茶汉化组" ||
		!slices.Equal(got.FileNames, []string{"game.part1.rar", "game.part2.rar"}) || !got.Discs || got.Info.Translation != nil {
		t.Fatalf("first %+v", got)
	}
	if got := listed[0]; got.GameID != gameID || got.Published || got.Canonical || len(got.Files) != 2 || got.Files[0].Name != "game.part1.rar" || got.Files[0].OriginalName != nil {
		t.Fatalf("the files of the first %+v", got)
	}
	if got := listed[1]; got.Discs || got.Note != nil || len(got.FileNames) != 0 || *got.Info.Translation != download.TranslationNone || *got.Info.Form != download.FormPortable {
		t.Fatalf("second %+v", got)
	}
	rest, err := store.ListUndescribed(ctx, second.ID, 2)
	if err != nil || len(rest) != 1 || rest[0].ID != third.ID {
		t.Fatalf("rest %+v %v", rest, err)
	}
	fetched, waiting := f.db.Game(t), f.db.Game(t)
	f.db.Ent.CatalogSourceLink.Create().SetSource("hikarinagi").SetEntity("game").SetExternalID("901").SetLocalID(fetched).SetSyncedAt(time.Now()).ExecX(ctx)
	f.db.Ent.CatalogSourceLink.Create().SetSource("hikarinagi").SetEntity("game").SetExternalID("902").SetLocalID(waiting).ExecX(ctx)
	ready := f.resource(t, fetched, creator, func(c *ent.GameDownloadResourceCreate) { c.SetUndescribed(true) })
	early := f.resource(t, waiting, creator, func(c *ent.GameDownloadResourceCreate) { c.SetUndescribed(true) })
	linked, err := store.ListUndescribed(ctx, third.ID, 5)
	if err != nil || len(linked) != 2 || linked[0].ID != ready.ID || linked[0].Awaiting || linked[1].ID != early.ID || !linked[1].Awaiting {
		t.Fatalf("a resource tells whether its game still waits for its catalog entry: %+v %v", linked, err)
	}
	if listed[0].Awaiting || rest[0].Awaiting {
		t.Fatalf("a game without a catalog entry waits for nothing: %+v %+v", listed[0], rest[0])
	}
	if none, err := store.ListUndescribed(ctx, early.ID, 2); err != nil || len(none) != 0 {
		t.Fatalf("nothing after the last: %+v %v", none, err)
	}
}

func TestLegacyStoreDescribesWithoutTouchingTheUpdateTime(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := downloadpg.NewLegacyStore(f.db.Ent)
	creator, gameID := f.db.User(t), f.db.Game(t)
	tea := f.db.Ent.Translator.Create().SetName("绿茶汉化组").SetNameKey(translator.Key("绿茶汉化组")).SaveX(ctx)
	resource := f.resource(t, gameID, creator, func(c *ent.GameDownloadResourceCreate) {
		c.SetLanguage(pgvalue.Strings{"zh"}).SetNote(paragraph("绿茶汉化组")).SetNoteText("绿茶汉化组").SetUndescribed(true)
	})
	before, err := f.repo.GetResource(ctx, resource.ID)
	if err != nil {
		t.Fatal(err)
	}

	description := download.LegacyDescription{
		Translation: ptr(download.TranslationGroup),
		Translators: []translator.Ref{{ID: tea.ID, Name: tea.Name}},
		ReleaseURL:  ptr("https://example.org/release"),
		Edition:     ptr(download.EditionDownload),
		Form:        ptr(download.FormDisc),
		ClearNote:   true,
	}
	if err := store.Describe(ctx, resource.ID, description); err != nil {
		t.Fatal(err)
	}
	got, err := f.repo.GetResource(ctx, resource.ID)
	if err != nil || got.Note != nil || f.db.Ent.GameDownloadResource.GetX(ctx, resource.ID).NoteText != "" || *got.Info.Translation != download.TranslationGroup || len(got.Info.Translators) != 1 || got.Info.Translators[0].ID != tea.ID ||
		*got.Info.ReleaseURL != "https://example.org/release" || *got.Info.Edition != download.EditionDownload || *got.Info.Form != download.FormDisc {
		t.Fatalf("described %+v %v", got, err)
	}
	if !got.Updated.Equal(before.Updated) {
		t.Fatalf("the update time is kept: %v %v", got.Updated, before.Updated)
	}
	if left, err := store.ListUndescribed(ctx, resource.ID-1, 1); err != nil || len(left) != 0 {
		t.Fatalf("a described resource is not listed again: %+v %v", left, err)
	}

	if err := store.Describe(ctx, resource.ID, download.LegacyDescription{Edition: ptr(download.EditionSteam)}); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); *got.Info.Edition != download.EditionSteam || *got.Info.Translation != download.TranslationGroup || len(got.Info.Translators) != 1 {
		t.Fatalf("what a description leaves out stays: %+v", got)
	}
	if err := store.Describe(ctx, 987654, description); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("missing resource: %v", err)
	}

	first := f.file(t, resource.ID, creator, "[BABEL] 妹嫁.part1.rar")
	second := f.file(t, resource.ID, creator, "bonus.zip")
	f.db.Ent.GameDownloadResource.UpdateOneID(resource.ID).SetPublishedAt(time.Now()).ExecX(ctx)
	settled, _ := f.repo.GetResource(ctx, resource.ID)
	if err := store.Describe(ctx, resource.ID, download.LegacyDescription{EditionName: ptr("初回版"), Canonical: []int{first.ID}}); err != nil {
		t.Fatal(err)
	}
	named, _ := f.repo.GetResource(ctx, resource.ID)
	if !named.Canonical || *named.Info.EditionName != "初回版" || !named.Updated.Equal(settled.Updated) {
		t.Fatalf("the resource takes canonical names: %+v", named)
	}
	if kept, _ := f.repo.GetFile(ctx, first.ID); kept.OriginalName == nil || *kept.OriginalName != "[BABEL] 妹嫁.part1.rar" {
		t.Fatalf("the name the file had is kept: %+v", kept)
	}
	if other, _ := f.repo.GetFile(ctx, second.ID); other.OriginalName != nil {
		t.Fatalf("another file is left alone: %+v", other)
	}
	f.db.Ent.GameDownloadResource.UpdateOneID(resource.ID).SetUndescribed(true).ExecX(ctx)
	listed, _ := store.ListUndescribed(ctx, resource.ID-1, 1)
	if len(listed) != 1 || !listed[0].Published || !listed[0].Canonical || listed[0].Files[0].OriginalName == nil {
		t.Fatalf("listed again %+v", listed)
	}
}
