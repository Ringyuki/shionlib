package download_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

const canonicalStem = "[250926][ブランド] ゲーム 游戏 [绿茶汉化组] (files)"

func (f fixture) canonical(mutate ...func(*download.Resource)) download.Resource {
	resource := download.Resource{
		GameID: 10, CreatorID: owner.UserID, Platforms: []string{"win"}, Languages: []string{"zh"}, PublishedAt: ptr(now), Canonical: true,
		Info: download.Info{Translation: ptr(download.TranslationGroup), Translators: []translator.Ref{{ID: 1, Name: "绿茶汉化组"}}, Form: ptr(download.FormPortable), Extras: []string{}},
	}
	for _, change := range mutate {
		change(&resource)
	}
	return f.repo.SeedResource(resource)
}

func (f fixture) uploaded(resourceID int, name string, mutate ...func(*download.File)) download.File {
	file := download.File{ResourceID: resourceID, Name: name, OriginalName: &name, CreatorID: owner.UserID, Status: download.FileInObjectStore, CheckStatus: download.CheckOK}
	for _, change := range mutate {
		change(&file)
	}
	return f.repo.SeedFile(file)
}

func (f fixture) nameOf(t *testing.T, fileID int) string {
	t.Helper()
	file, err := f.repo.GetFile(context.Background(), fileID)
	if err != nil {
		t.Fatal(err)
	}
	return file.Name
}

func TestApplyNamesTheFirstFileAndEveryVolumeOfItsSet(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	resource := f.canonical()
	first := f.uploaded(resource.ID, "upload.part1.rar")
	second := f.uploaded(resource.ID, "upload.part2.rar")
	other := f.uploaded(resource.ID, "bonus.zip")
	if err := f.names.Apply(ctx, resource.ID); err != nil {
		t.Fatal(err)
	}
	if got := f.nameOf(t, first.ID); got != canonicalStem+".part1.rar" {
		t.Fatalf("first volume %q", got)
	}
	if got := f.nameOf(t, second.ID); got != canonicalStem+".part2.rar" {
		t.Fatalf("second volume %q", got)
	}
	if got := f.nameOf(t, other.ID); got != "bonus.zip" {
		t.Fatalf("another file keeps the name it was uploaded with: %q", got)
	}
	stored, _ := f.repo.GetFile(ctx, first.ID)
	if stored.OriginalName == nil || *stored.OriginalName != "upload.part1.rar" {
		t.Fatalf("the uploaded name is kept: %+v", stored.OriginalName)
	}
	if err := f.names.Apply(ctx, resource.ID); err != nil || f.nameOf(t, first.ID) != canonicalStem+".part1.rar" {
		t.Fatalf("applying again changes nothing: %v", err)
	}
}

func TestApplyLeavesWhatIsNotPublishedCanonicalOrActive(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	for name, mutate := range map[string]func(*download.Resource){
		"unpublished":   func(r *download.Resource) { r.PublishedAt = nil },
		"not canonical": func(r *download.Resource) { r.Canonical = false },
		"removed":       func(r *download.Resource) { r.Status = download.ResourceRemoved },
	} {
		resource := f.canonical(mutate)
		file := f.uploaded(resource.ID, name+".7z")
		if err := f.names.Apply(ctx, resource.ID); err != nil || f.nameOf(t, file.ID) != name+".7z" {
			t.Fatalf("%s: %q %v", name, f.nameOf(t, file.ID), err)
		}
	}
	if err := f.names.Apply(ctx, 987654); err != nil {
		t.Fatalf("a resource that is gone is skipped: %v", err)
	}
	if err := f.names.Apply(ctx, f.canonical().ID); err != nil {
		t.Fatalf("a resource without files is skipped: %v", err)
	}
}

func TestApplyWaitsForTheFormatOfADiscImage(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	disc := func(r *download.Resource) {
		r.Languages = []string{"jp"}
		r.Info = download.Info{Translation: ptr(download.TranslationNone), Form: ptr(download.FormDisc), Extras: []string{}}
	}
	waiting := f.canonical(disc)
	unknown := f.uploaded(waiting.ID, "disc.7z")
	if err := f.names.Apply(ctx, waiting.ID); err != nil || f.nameOf(t, unknown.ID) != "disc.7z" {
		t.Fatalf("a format that is not known yet keeps the uploaded name: %q %v", f.nameOf(t, unknown.ID), err)
	}

	f.media.Formats[5] = "iso+mds+rr3"
	inspected := f.canonical(disc)
	known := f.uploaded(inspected.ID, "disc.7z", func(file *download.File) { file.InspectionID = ptr(5) })
	if err := f.names.Apply(ctx, inspected.ID); err != nil || f.nameOf(t, known.ID) != "[250926][ブランド] ゲーム (iso+mds+rr3).7z" {
		t.Fatalf("the format the check found: %q %v", f.nameOf(t, known.ID), err)
	}

	legacy := f.canonical(disc)
	named := f.uploaded(legacy.ID, "[250926][ブランド] ゲーム 初回版 (mdf+mds rr3%).rar")
	if err := f.names.Apply(ctx, legacy.ID); err != nil || f.nameOf(t, named.ID) != "[250926][ブランド] ゲーム (mdf+mds+rr3).rar" {
		t.Fatalf("the format an old name states: %q %v", f.nameOf(t, named.ID), err)
	}
}

func TestApplySkipsANameAnotherFileHolds(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	resource := f.canonical()
	main := f.uploaded(resource.ID, "a.7z")
	f.uploaded(resource.ID, canonicalStem+".7z")
	if err := f.names.Apply(ctx, resource.ID); err != nil || f.nameOf(t, main.ID) != "a.7z" {
		t.Fatalf("taken name: %q %v", f.nameOf(t, main.ID), err)
	}
}

func TestEditRenamesAndTurningCanonicalNamesOffRestoresTheUploadedName(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.translators.Seed(translator.Translator{Name: "绿茶汉化组"})
	resource := f.canonical()
	file := f.uploaded(resource.ID, "upload.7z")
	edit := download.EditInput{Platforms: []string{"win"}, Languages: []string{"zh"}, Info: download.InfoInput{Translation: ptr(download.TranslationGroup), Translators: []string{"绿茶汉化组"}, PatchVersion: ptr("v1.2"), Form: ptr(download.FormPortable)}}
	if err := f.service.Edit(ctx, owner, resource.ID, edit); err != nil {
		t.Fatal(err)
	}
	if got := f.nameOf(t, file.ID); got != "[250926][ブランド] ゲーム 游戏 [绿茶汉化组][v1.2] (files).7z" {
		t.Fatalf("an edit writes the new name: %q", got)
	}
	if err := f.service.RenameFile(ctx, owner, file.ID, "mine.7z"); !errors.Is(err, download.ErrFileNameCanonical) {
		t.Fatalf("a canonical name cannot be changed by hand: %v", err)
	}

	edit.Canonical = ptr(false)
	if err := f.service.Edit(ctx, owner, resource.ID, edit); err != nil {
		t.Fatal(err)
	}
	if got := f.nameOf(t, file.ID); got != "upload.7z" {
		t.Fatalf("turning canonical names off restores the uploaded name: %q", got)
	}
	if err := f.service.RenameFile(ctx, owner, file.ID, "mine.7z"); err != nil || f.nameOf(t, file.ID) != "mine.7z" {
		t.Fatalf("the file can be renamed again: %v", err)
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); got.Canonical {
		t.Fatal("the choice is stored")
	}

	edit.Canonical = nil
	if err := f.service.Edit(ctx, owner, resource.ID, edit); err != nil || f.nameOf(t, file.ID) != "mine.7z" {
		t.Fatalf("an edit that says nothing about names keeps the choice: %q %v", f.nameOf(t, file.ID), err)
	}
	edit.Canonical = ptr(true)
	if err := f.service.Edit(ctx, owner, resource.ID, edit); err != nil || f.nameOf(t, file.ID) != "[250926][ブランド] ゲーム 游戏 [绿茶汉化组][v1.2] (files).7z" {
		t.Fatalf("turning them on again writes the canonical name: %q %v", f.nameOf(t, file.ID), err)
	}
}

func TestOtherFilesOfACanonicalResourceCanStillBeRenamed(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	resource := f.canonical()
	f.uploaded(resource.ID, "main.7z")
	other := f.uploaded(resource.ID, "bonus.zip")
	if err := f.service.RenameFile(ctx, owner, other.ID, "特典.zip"); err != nil || f.nameOf(t, other.ID) != "特典.zip" {
		t.Fatalf("rename another file: %v", err)
	}
}

func TestPreviewNamesAnUploadBeforeItExists(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	preview := download.NamePreview{GameID: 10, Languages: []string{"zh"}, Uploaded: "llj_chs.7z", Info: download.InfoInput{
		Translation: ptr(download.TranslationGroup), Translators: []string{" 绿茶汉化组 ", "熊喵守护协会"}, PatchVersion: ptr("v1.1"), Form: ptr(download.FormPortable),
	}}
	name, err := f.names.Preview(ctx, preview)
	if err != nil || name.Pending || name.String() != "[250926][ブランド] ゲーム 游戏 [绿茶汉化组×熊喵守护协会][v1.1] (files).7z" {
		t.Fatalf("preview %+v %v", name, err)
	}
	preview.Info = download.InfoInput{Form: ptr(download.FormDisc)}
	preview.Languages = []string{"jp"}
	if name, err := f.names.Preview(ctx, preview); err != nil || !name.Pending || name.Before != "[250926][ブランド] ゲーム (" || name.After != ").7z" {
		t.Fatalf("a disc image waits for its format: %+v %v", name, err)
	}
	preview.Uploaded = "[250926][ブランド] ゲーム (iso+mds).rar"
	if name, err := f.names.Preview(ctx, preview); err != nil || name.Pending || name.String() != "[250926][ブランド] ゲーム (iso+mds).rar" {
		t.Fatalf("a format the uploaded name states is used: %+v %v", name, err)
	}
	preview.Info = download.InfoInput{}
	if name, err := f.names.Preview(ctx, preview); err != nil || name.String() != "[250926][ブランド] ゲーム (iso+mds).rar" {
		t.Fatalf("what the uploaded name states stands while the form is not chosen: %+v %v", name, err)
	}
	preview.Uploaded = "upload.rar"
	if name, err := f.names.Preview(ctx, preview); err != nil || name.String() != "[250926][ブランド] ゲーム.rar" {
		t.Fatalf("a form that is not chosen yet is left out: %+v %v", name, err)
	}
	preview.GameID = 404
	if _, err := f.names.Preview(ctx, preview); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
}

func TestPreviewNamesTheFirstFileOfAResource(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.media.Formats[7] = "bin+cue"
	resource := f.canonical()
	f.uploaded(resource.ID, "upload.part1.rar", func(file *download.File) { file.InspectionID = ptr(7) })
	preview := download.NamePreview{GameID: 10, ResourceID: &resource.ID, Languages: []string{"jp"}, Uploaded: "ignored.zip", Info: download.InfoInput{Form: ptr(download.FormDisc)}}
	if name, err := f.names.Preview(ctx, preview); err != nil || name.Pending || name.String() != "[250926][ブランド] ゲーム (bin+cue).part1.rar" {
		t.Fatalf("preview of a resource %+v %v", name, err)
	}
	preview.GameID = 11
	if _, err := f.names.Preview(ctx, preview); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("a resource of another game: %v", err)
	}
}

func TestFormReadWritesTheNameOnceTheDiscFormatIsKnown(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.media.Formats[9] = "iso+mds"
	resource := f.canonical(func(r *download.Resource) {
		r.Languages = []string{"jp"}
		r.Info = download.Info{Translation: ptr(download.TranslationNone), Form: ptr(download.FormPortable), Extras: []string{}}
	})
	file := f.uploaded(resource.ID, "disc.7z", func(file *download.File) { file.InspectionID = ptr(9) })
	if err := f.service.FormRead(ctx, resource.ID, download.FormDisc); err != nil {
		t.Fatal(err)
	}
	if got := f.nameOf(t, file.ID); got != "[250926][ブランド] ゲーム (iso+mds).7z" {
		t.Fatalf("name after the disc was found: %q", got)
	}
	f.media.Formats[9] = "iso+mds+rr3"
	if err := f.service.FormRead(ctx, resource.ID, download.FormDisc); err != nil || f.nameOf(t, file.ID) != "[250926][ブランド] ゲーム (iso+mds+rr3).7z" {
		t.Fatalf("a resource that already is a disc image still gets its name: %q %v", f.nameOf(t, file.ID), err)
	}
}

func TestRenameJobsFollowAGameAndATranslator(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	credited := f.canonical()
	first := f.uploaded(credited.ID, "a.7z")
	other := f.canonical(func(r *download.Resource) {
		r.Info.Translators = []translator.Ref{{ID: 2, Name: "熊喵守护协会"}}
	})
	second := f.uploaded(other.ID, "b.7z")
	elsewhere := f.canonical(func(r *download.Resource) { r.GameID = 11 })
	third := f.uploaded(elsewhere.ID, "c.7z")

	if err := f.names.Rename(ctx, download.RenameFiles{TranslatorID: 2}); err != nil {
		t.Fatal(err)
	}
	if f.nameOf(t, first.ID) != "a.7z" || f.nameOf(t, second.ID) != "[250926][ブランド] ゲーム 游戏 [熊喵守护协会] (files).7z" {
		t.Fatalf("only the resources crediting the translator: %q %q", f.nameOf(t, first.ID), f.nameOf(t, second.ID))
	}
	if err := f.names.Rename(ctx, download.RenameFiles{GameID: 10}); err != nil {
		t.Fatal(err)
	}
	if f.nameOf(t, first.ID) != canonicalStem+".7z" || f.nameOf(t, third.ID) != "c.7z" {
		t.Fatalf("every resource of the game and no other: %q %q", f.nameOf(t, first.ID), f.nameOf(t, third.ID))
	}
	if err := f.names.Rename(ctx, download.RenameFiles{}); err != nil {
		t.Fatalf("a job that names nothing does nothing: %v", err)
	}
}

func TestCreateKeepsTheUploadedNameUntilThePublication(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.completed(5, "upload.7z", 2048)
	created, err := f.service.Create(ctx, owner, 10, download.CreateInput{Platforms: []string{"win"}, Languages: []string{"jp"}, Info: portable, Canonical: true, Files: []download.FileUpload{{UploadSessionID: 5}}})
	if err != nil {
		t.Fatal(err)
	}
	files, _ := f.repo.ListFiles(ctx, created.ID)
	if got, _ := f.repo.GetResource(ctx, created.ID); !got.Canonical || len(files) != 1 || files[0].Name != "upload.7z" || files[0].OriginalName == nil || *files[0].OriginalName != "upload.7z" {
		t.Fatalf("created %+v %+v", got, files)
	}
}
