package download_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const composedName = "[250926][ブランド] ゲーム 游戏 [绿茶汉化组][v1.1] (files).7z"

type composedFixture struct {
	fixture
	composed *download.ComposedService
}

func newComposedFixture() composedFixture {
	f := newFixture()
	transfers := download.NewTransferService(f.repo, f.store, f.spool, f.events, f.events, f.names, &txtest.Immediate{}, func() time.Time { return now })
	return composedFixture{fixture: f, composed: download.NewComposedService(f.service, transfers)}
}

func composedDraft() download.ComposedDraft {
	group, portable := download.TranslationGroup, download.FormPortable
	return download.ComposedDraft{
		GameID:    10,
		Platforms: []string{"win"},
		Languages: []string{"zh"},
		Info:      download.InfoInput{Translation: &group, Translators: []string{"绿茶汉化组"}, PatchVersion: ptr("v1.1"), Form: &portable, Extras: []string{download.ExtraSave}},
	}
}

func (f composedFixture) packed(name string, content string) string {
	path := f.spool.Path(name)
	f.spool.Put(path, []byte(content), now)
	return path
}

func TestAComposedResourceBeginsWithoutFiles(t *testing.T) {
	ctx := context.Background()
	f := newComposedFixture()
	resource, err := f.composed.Begin(ctx, owner, composedDraft())
	if err != nil {
		t.Fatal(err)
	}
	stored, _ := f.repo.GetResource(ctx, resource.ID)
	if stored.Published() || !stored.Canonical || stored.CreatorID != owner.UserID || !slices.Equal(stored.Languages, []string{"zh"}) || !slices.Equal(stored.Platforms, []string{"win"}) {
		t.Fatalf("resource: %+v", stored)
	}
	info := stored.Info
	if info.Translation == nil || *info.Translation != download.TranslationGroup || len(info.Translators) != 1 || info.Translators[0].Name != "绿茶汉化组" || *info.PatchVersion != "v1.1" || *info.Form != download.FormPortable || !slices.Equal(info.Extras, []string{download.ExtraSave}) {
		t.Fatalf("information: %+v", info)
	}
	if files, _ := f.repo.ListFiles(ctx, resource.ID); len(files) != 0 {
		t.Fatalf("no file yet: %+v", files)
	}

	missing := composedDraft()
	missing.GameID = 999
	if _, err := f.composed.Begin(ctx, owner, missing); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("a game that is not there: %v", err)
	}
	unsaid := composedDraft()
	unsaid.Info.Translation = nil
	if _, err := f.composed.Begin(ctx, owner, unsaid); !errors.Is(err, apperror.ErrValidationFailed) {
		t.Fatalf("a translation must say where it comes from: %v", err)
	}
}

func TestPublishingAComposedFileStoresItAndPublishesTheResource(t *testing.T) {
	ctx := context.Background()
	f := newComposedFixture()
	resource, err := f.composed.Begin(ctx, owner, composedDraft())
	if err != nil {
		t.Fatal(err)
	}
	stale := "/spool/old-attempt.part"
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "old attempt.7z", Path: &stale, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: owner.UserID})
	path := f.packed("out", "composed archive")
	changes := []download.FieldChange{{Field: download.FieldBase, New: []string{"原版.7z"}}, {Field: download.FieldPatchVersion, New: []string{"v1.1"}}}

	in := download.ComposedFile{ResourceID: resource.ID, Name: composedName, LocalPath: path, Size: 16, SHA256: "aa11", InspectionID: 31, Changes: changes}
	if err := f.composed.Publish(ctx, in); err != nil {
		t.Fatal(err)
	}
	files, _ := f.repo.ListFiles(ctx, resource.ID)
	if len(files) != 1 {
		t.Fatalf("the file of an earlier attempt gives way: %+v", files)
	}
	file := files[0]
	key := download.StorageKey(10, file.ID, composedName)
	if file.Name != composedName || file.Status != download.FileInObjectStore || file.CheckStatus != download.CheckOK || file.StorageKey == nil || *file.StorageKey != key || file.SHA256 == nil || *file.SHA256 != "aa11" || file.InspectionID == nil || *file.InspectionID != 31 || file.HashAlgorithm != upload.HashSHA256 || file.Size != 16 {
		t.Fatalf("file: %+v", file)
	}
	if object, ok := f.store.Objects[key]; !ok || object.LocalPath != path {
		t.Fatalf("stored object: %+v", f.store.Objects)
	}
	if _, kept := f.spool.Content(path); kept {
		t.Fatal("the local copy is removed")
	}
	if published, _ := f.repo.GetResource(ctx, resource.ID); !published.Published() {
		t.Fatal("the resource is published")
	}
	events := f.repo.Events(resource.ID)
	if len(events) != 1 || events[0].Kind != download.EventComposed || len(events[0].Data.Files) != 1 || events[0].Data.Files[0].Name != composedName || !slices.EqualFunc(events[0].Data.Changes, changes, func(a, b download.FieldChange) bool {
		return a.Field == b.Field && slices.Equal(a.New, b.New)
	}) {
		t.Fatalf("one event says how the resource came to be: %+v", events)
	}
	if histories := f.repo.Histories(file.ID); len(histories) != 1 || *histories[0].StorageKey != key {
		t.Fatalf("history: %+v", histories)
	}
	if messages := f.events.Messages(); len(messages) != 0 {
		t.Fatalf("the message is left to whoever composed the resource: %+v", messages)
	}
	objects := len(f.store.Objects)
	if err := f.composed.Publish(ctx, in); err != nil || len(f.store.Objects) != objects || len(f.repo.Events(resource.ID)) != 1 {
		t.Fatalf("publishing again changes nothing: %v", err)
	}
}

func TestReplacingAComposedFileKeepsTheOldOneUntilTheNewOneIsStored(t *testing.T) {
	ctx := context.Background()
	f := newComposedFixture()
	resource, err := f.composed.Begin(ctx, owner, composedDraft())
	if err != nil {
		t.Fatal(err)
	}
	first := f.packed("first", "v1.1 archive")
	if err := f.composed.Publish(ctx, download.ComposedFile{ResourceID: resource.ID, Name: composedName, LocalPath: first, Size: 12, SHA256: "aa11", InspectionID: 31}); err != nil {
		t.Fatal(err)
	}
	files, _ := f.repo.ListFiles(ctx, resource.ID)
	file := files[0]
	oldKey := *file.StorageKey
	f.repo.SeedFavorite(10, 77)
	f.repo.SeedFavorite(10, owner.UserID)

	next := f.packed("next", "v1.2 archive!")
	newName := "[250926][ブランド] ゲーム 游戏 [绿茶汉化组][v1.2] (files).7z"
	replacement := download.ComposedReplacement{FileID: file.ID, OperatorID: owner.UserID, Name: newName, LocalPath: next, Size: 13, SHA256: "bb22", InspectionID: 32, PatchVersion: ptr("v1.2"), Extras: []string{download.ExtraSave}, Reason: ptr("修正第三章的错字")}
	if err := f.composed.Replace(ctx, replacement); err != nil {
		t.Fatal(err)
	}
	newKey := download.StorageKey(10, file.ID, newName)
	replaced, _ := f.repo.GetFile(ctx, file.ID)
	if replaced.Name != newName || replaced.Size != 13 || *replaced.SHA256 != "bb22" || *replaced.InspectionID != 32 || *replaced.StorageKey != newKey || replaced.Status != download.FileInObjectStore || replaced.Path != nil {
		t.Fatalf("the file holds the new content in place: %+v", replaced)
	}
	if object, ok := f.store.Objects[newKey]; !ok || object.LocalPath != next {
		t.Fatalf("the new object: %+v", f.store.Objects)
	}
	if updated, _ := f.repo.GetResource(ctx, resource.ID); *updated.Info.PatchVersion != "v1.2" {
		t.Fatalf("patch version: %+v", updated.Info)
	}
	events := f.repo.Events(resource.ID)
	latest := events[len(events)-1]
	if len(events) != 2 || latest.Kind != download.EventRecomposed || latest.Data.Name != newName || latest.Data.OldName != composedName || *latest.Data.OldSize != 12 || *latest.Data.NewSize != 13 || *latest.Data.Reason != "修正第三章的错字" {
		t.Fatalf("event: %+v", events)
	}
	if changes := latest.Data.Changes; len(changes) != 1 || changes[0].Field != download.FieldPatchVersion || !slices.Equal(changes[0].Old, []string{"v1.1"}) || !slices.Equal(changes[0].New, []string{"v1.2"}) {
		t.Fatalf("the event says what changed: %+v", latest.Data.Changes)
	}
	if histories := f.repo.Histories(file.ID); len(histories) != 2 {
		t.Fatalf("each version is in the history: %+v", histories)
	}
	messages := f.events.Messages()
	if len(messages) != 1 || messages[0].ReceiverID != 77 || messages[0].Title != "Messages.System.File.Reupload.FileReuploadedTitle" {
		t.Fatalf("those who keep the game are told, the uploader is not: %+v", messages)
	}
	jobs := f.events.Jobs()
	if len(jobs) != 1 || !slices.Equal(jobs[0].(download.PurgeObjects).Keys, []string{oldKey}) {
		t.Fatalf("the old object is removed afterwards: %+v", jobs)
	}
	if _, kept := f.spool.Content(next); kept {
		t.Fatal("the local copy is removed")
	}

	same := f.packed("same", "v1.2 archive again")
	replacement.LocalPath, replacement.SHA256, replacement.Size = same, "cc33", 18
	if err := f.composed.Replace(ctx, replacement); err != nil {
		t.Fatal(err)
	}
	jobs = f.events.Jobs()
	if purge := jobs[len(jobs)-1].(download.PurgeObjects); !slices.Equal(purge.Keys, []string{newKey}) || !purge.Before.Equal(now) {
		t.Fatalf("under an unchanged name only the older versions are removed: %+v", purge)
	}
}

func TestOnlyAStoredFileIsReplaced(t *testing.T) {
	ctx := context.Background()
	f := newComposedFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	path := "/spool/pending.part"
	pending := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "pending.7z", Path: &path, Status: download.FileOnServer, CreatorID: owner.UserID})
	err := f.composed.Replace(ctx, download.ComposedReplacement{FileID: pending.ID, OperatorID: owner.UserID, Name: "x.7z", LocalPath: f.packed("x", "x")})
	if !errors.Is(err, upload.ErrInvalidFileStatus) || len(f.store.Objects) != 0 {
		t.Fatalf("a file that is not stored: %v", err)
	}
}

func TestWhoMayRecomposeAndWhatIsDiscarded(t *testing.T) {
	ctx := context.Background()
	f := newComposedFixture()
	resource, err := f.composed.Begin(ctx, owner, composedDraft())
	if err != nil {
		t.Fatal(err)
	}
	if owned, err := f.composed.Owned(ctx, owner, resource.ID); err != nil || owned.ID != resource.ID {
		t.Fatalf("the uploader: %+v %v", owned, err)
	}
	if _, err := f.composed.Owned(ctx, admin, resource.ID); err != nil {
		t.Fatalf("an administrator: %v", err)
	}
	if _, err := f.composed.Owned(ctx, other, resource.ID); !errors.Is(err, download.ErrResourceNotOwner) {
		t.Fatalf("someone else: %v", err)
	}

	if err := f.composed.Discard(ctx, resource.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.GetResource(ctx, resource.ID); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("a resource that never got its file is removed: %v", err)
	}
	if err := f.composed.Discard(ctx, resource.ID); err != nil {
		t.Fatalf("discarding what is gone: %v", err)
	}
	kept, _ := f.composed.Begin(ctx, owner, composedDraft())
	if err := f.composed.Publish(ctx, download.ComposedFile{ResourceID: kept.ID, Name: composedName, LocalPath: f.packed("kept", "kept"), Size: 4, SHA256: "dd44", InspectionID: 33}); err != nil {
		t.Fatal(err)
	}
	if err := f.composed.Discard(ctx, kept.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.GetResource(ctx, kept.ID); err != nil {
		t.Fatalf("a published resource stays: %v", err)
	}
}
