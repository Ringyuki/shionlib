package download_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator/translatortest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

func TestLegacyDescribeReportsWithoutWritingThenWrites(t *testing.T) {
	ctx := context.Background()
	repo := downloadtest.NewMemoryRepository(func() time.Time { return now })
	translators := translatortest.NewMemoryRepository()
	tea := translators.Seed(translator.Translator{Name: "绿茶汉化组"})
	released := time.Date(2014, 12, 19, 0, 0, 0, 0, time.UTC)
	cards := gametest.NewCards(
		game.Card{ID: 1, TitleJP: "妹嫁", TitleZH: "妹妹新娘", Developers: []game.Credit{{Developer: game.DeveloperRef{Name: "バベル", Aliases: []string{"BABEL"}}}}},
		game.Card{ID: 2, TitleJP: "アマカノ", ReleaseDate: &released, Developers: []game.Credit{{Developer: game.DeveloperRef{Name: "あざらしそふと"}}}},
		game.Card{ID: 3, TitleJP: "ゲーム"}, game.Card{ID: 4, TitleJP: "ゲーム"},
	)
	service := download.NewLegacyService(repo, cards, translator.NewService(translators), downloadtest.Names(repo, cards, downloadtest.Media{}), &txtest.Immediate{})

	credited := repo.SeedResource(download.Resource{GameID: 1, CreatorID: 7, Languages: []string{"zh"}, Note: ptr("绿茶汉化组×熊喵守护协会"), PublishedAt: ptr(now)})
	translated := repo.SeedFile(download.File{ResourceID: credited.ID, Name: "[BABEL] 妹嫁 妹妹新娘.zip"})
	original := repo.SeedResource(download.Resource{GameID: 2, CreatorID: 8, Languages: []string{"jp"}, Note: ptr("DL版，含特典"), PublishedAt: ptr(now)})
	packed := repo.SeedFile(download.File{ResourceID: original.ID, Name: "[あざらしそふと] アマカノ DL版 初回版 (files).7z"})
	inspected := repo.SeedResource(download.Resource{GameID: 3, CreatorID: 8, Languages: []string{"jp"}})
	repo.SeedFile(download.File{ResourceID: inspected.ID, Name: "game.7z"})
	repo.Discs[inspected.ID] = true
	unknown := repo.SeedResource(download.Resource{GameID: 4, CreatorID: 8, Languages: []string{"zh"}, Note: ptr("吉里吉里模拟器")})

	report, err := service.Describe(ctx, false)
	if err != nil || report.Resources != 3 || report.Translations[download.TranslationGroup] != 1 || report.Translations[download.TranslationNone] != 2 ||
		report.Editions[download.EditionDownload] != 1 || report.Discs != 1 || report.NotesCleared != 1 || report.Translators["熊喵守护协会"] != 1 || report.Canonical != 2 {
		t.Fatalf("report %+v %v", report, err)
	}
	wanted := []download.LegacyRename{
		{From: "[BABEL] 妹嫁 妹妹新娘.zip", To: "[バベル] 妹嫁 妹妹新娘 [绿茶汉化组×熊喵守护协会].zip"},
		{From: "[あざらしそふと] アマカノ DL版 初回版 (files).7z", To: "[141219][あざらしそふと] アマカノ DL版 初回版 (files).7z"},
	}
	if !slices.Equal(report.Renames, wanted) {
		t.Fatalf("the report shows the names that would change: %+v", report.Renames)
	}
	if got, _ := repo.GetResource(ctx, credited.ID); got.Info.Translation != nil || got.Note == nil || got.Canonical {
		t.Fatalf("a report writes nothing: %+v", got)
	}

	applied, err := service.Describe(ctx, true)
	if err != nil || applied.Resources != 3 {
		t.Fatalf("applied %+v %v", applied, err)
	}
	got, _ := repo.GetResource(ctx, credited.ID)
	if got.Note != nil || *got.Info.Translation != download.TranslationGroup || len(got.Info.Translators) != 2 || got.Info.Translators[0].ID != tea.ID || got.Info.Translators[1].Name != "熊喵守护协会" {
		t.Fatalf("credited %+v", got)
	}
	created, err := translators.Get(ctx, got.Info.Translators[1].ID)
	if err != nil || created.CreatorID == nil || *created.CreatorID != 7 {
		t.Fatalf("a name that is new creates its translator for the uploader: %+v %v", created, err)
	}
	if got, _ := repo.GetResource(ctx, original.ID); *got.Info.Translation != download.TranslationNone || *got.Info.Edition != download.EditionDownload || *got.Info.EditionName != "初回版" || got.Info.Form != nil || got.Note == nil || !got.Canonical {
		t.Fatalf("original %+v", got)
	}
	if renamed, _ := repo.GetFile(ctx, packed.ID); renamed.Name != "[141219][あざらしそふと] アマカノ DL版 初回版 (files).7z" || *renamed.OriginalName != "[あざらしそふと] アマカノ DL版 初回版 (files).7z" {
		t.Fatalf("a name that is read whole becomes canonical and the old one is kept: %+v", renamed)
	}
	if renamed, _ := repo.GetFile(ctx, translated.ID); renamed.Name != "[バベル] 妹嫁 妹妹新娘 [绿茶汉化组×熊喵守护协会].zip" {
		t.Fatalf("the translators that were read are in the name: %+v", renamed)
	}
	if got, _ := repo.GetResource(ctx, inspected.ID); *got.Info.Form != download.FormDisc {
		t.Fatalf("inspected %+v", got)
	}
	if got, _ := repo.GetResource(ctx, unknown.ID); got.Info.Translation != nil || got.Note == nil {
		t.Fatalf("what cannot be told stays as it was: %+v", got)
	}

	again, err := service.Describe(ctx, true)
	if err != nil || again.Resources != 0 || len(again.Translators) != 0 {
		t.Fatalf("a second run finds nothing left to read: %+v %v", again, err)
	}
}
