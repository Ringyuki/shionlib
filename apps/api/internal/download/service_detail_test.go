package download_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func TestDetailFollowsWhatTheViewerMaySee(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	published := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: published.ID, Name: "game.7z", Status: download.FileInObjectStore, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: published.ID, Name: "extra.7z", Status: download.FileOnServer, CreatorID: owner.UserID})
	pending := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: pending.ID, Name: "new.7z", Status: download.FileOnServer, CreatorID: owner.UserID})
	held := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: held.ID, Name: "held.7z", Status: download.FileOnServer, CheckStatus: download.CheckHarmfulPendingReview, CreatorID: owner.UserID})
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Status: download.ResourceRemoved, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: removed.ID, Status: download.FileInObjectStore, CreatorID: owner.UserID})
	rated := f.repo.SeedResource(download.Resource{GameID: 11, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: rated.ID, Status: download.FileInObjectStore, CreatorID: owner.UserID})
	f.repo.MarkRated(11)
	composing := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	strict := actor.Actor{UserID: 9, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}

	seen, err := f.details.Detail(ctx, other, published.ID)
	if err != nil {
		t.Fatal(err)
	}
	if seen.Game.TitleJP != "ゲーム" || seen.Comments != 4 || len(seen.Files) != 1 || seen.Files[0].Name != "game.7z" {
		t.Fatalf("a visitor gets the game, the comment count and the stored files: %+v", seen)
	}
	if mine, _ := f.details.Detail(ctx, owner, published.ID); len(mine.Files) != 2 {
		t.Fatalf("the uploader also sees the file still being processed: %+v", mine.Files)
	}
	for name, id := range map[string]int{"unknown": 999, "unpublished": pending.ID, "under review": held.ID, "removed": removed.ID, "being composed": composing.ID} {
		if _, err := f.details.Detail(ctx, other, id); err == nil {
			t.Fatalf("%s resources are not found by others", name)
		} else {
			expectCode(t, err, download.ErrResourceNotFound)
		}
	}
	if made, err := f.details.Detail(ctx, owner, composing.ID); err != nil || len(made.Files) != 0 {
		t.Fatalf("whoever composes a resource opens it before it has a file: %+v %v", made.Files, err)
	}
	if _, err := f.details.Detail(ctx, admin, composing.ID); err != nil {
		t.Fatalf("an admin opens a resource being composed: %v", err)
	}
	for _, id := range []int{pending.ID, held.ID} {
		if _, err := f.details.Detail(ctx, owner, id); err != nil {
			t.Fatalf("the uploader opens resource %d: %v", id, err)
		}
		if overseen, err := f.details.Detail(ctx, admin, id); err != nil || len(overseen.Files) != 1 {
			t.Fatalf("an admin opens resource %d with the file that is not stored yet: %+v %v", id, overseen.Files, err)
		}
	}
	if _, err := f.details.Detail(ctx, admin, removed.ID); err == nil {
		t.Fatal("a removed resource is gone for an admin too")
	}
	if _, err := f.details.Detail(ctx, other, rated.ID); err != nil {
		t.Fatalf("a viewer who sees rated games opens their resources: %v", err)
	}
	if _, err := f.details.Detail(ctx, strict, rated.ID); err != nil {
		t.Fatalf("a viewer who hides rated games still opens their resources: %v", err)
	}
	_, err = f.details.Events(ctx, other, pending.ID)
	expectCode(t, err, download.ErrResourceNotFound)
}

func TestInspectionsAreThoseOfTheFilesTheViewerMaySee(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	published := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: published.ID, Name: "game.part1.rar", Status: download.FileInObjectStore, CreatorID: owner.UserID, InspectionID: ptr(7)})
	f.repo.SeedFile(download.File{ResourceID: published.ID, Name: "game.part2.rar", Status: download.FileInObjectStore, CreatorID: owner.UserID, InspectionID: ptr(7)})
	f.repo.SeedFile(download.File{ResourceID: published.ID, Name: "old.7z", Status: download.FileInObjectStore, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: published.ID, Name: "new.7z", Status: download.FileOnServer, CreatorID: owner.UserID, InspectionID: ptr(9)})
	if got, err := f.details.Inspections(ctx, other, published.ID); err != nil || len(got) != 1 || got[0] != 7 {
		t.Fatalf("a visitor gets each inspection of the stored files once: %v %v", got, err)
	}
	if got, err := f.details.Inspections(ctx, owner, published.ID); err != nil || len(got) != 2 || got[0] != 7 || got[1] != 9 {
		t.Fatalf("the uploader also gets the one of the file still being processed: %v %v", got, err)
	}
	unread := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: unread.ID, Name: "old.7z", Status: download.FileInObjectStore, CreatorID: owner.UserID})
	if got, err := f.details.Inspections(ctx, other, unread.ID); err != nil || got == nil || len(got) != 0 {
		t.Fatalf("a resource whose files were never read has none: %v %v", got, err)
	}
	_, err := f.details.Inspections(ctx, other, 999)
	expectCode(t, err, download.ErrResourceNotFound)
}
