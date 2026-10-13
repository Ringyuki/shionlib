package comment_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
)

func TestOnlyThePublisherPinsOneComment(t *testing.T) {
	ctx := context.Background()
	f := resourceFixture()
	first := f.repo.Seed(comment.Comment{GameID: gameID, ResourceID: ptr(resourceID), CreatorID: bob.UserID, Status: comment.StatusVisible})
	second := f.repo.Seed(comment.Comment{GameID: gameID, ResourceID: ptr(resourceID), CreatorID: alice.UserID, Status: comment.StatusVisible})
	reply := f.repo.Seed(comment.Comment{GameID: gameID, ResourceID: ptr(resourceID), CreatorID: alice.UserID, ParentID: &first.ID, RootID: &first.ID, Status: comment.StatusVisible})
	pending := f.repo.Seed(comment.Comment{GameID: gameID, ResourceID: ptr(resourceID), CreatorID: bob.UserID, Status: comment.StatusPending})
	onGame := f.repo.Seed(comment.Comment{GameID: gameID, CreatorID: bob.UserID, Status: comment.StatusVisible})
	pinned := func(id int) bool {
		stored, _ := f.repo.Get(ctx, id)
		return stored.Pinned()
	}

	if err := f.pins.Pin(ctx, alice, 404); !errors.Is(err, comment.ErrNotFound) {
		t.Fatalf("an unknown comment: %v", err)
	}
	for name, id := range map[string]int{"a reply": reply.ID, "a comment still under review": pending.ID, "a comment on the game": onGame.ID} {
		if err := f.pins.Pin(ctx, alice, id); !errors.Is(err, comment.ErrNotPinnable) {
			t.Fatalf("%s cannot be pinned: %v", name, err)
		}
	}
	if err := f.pins.Pin(ctx, bob, first.ID); !errors.Is(err, comment.ErrNotPublisher) {
		t.Fatalf("another user cannot pin, even their own comment: %v", err)
	}
	if err := f.pins.Pin(ctx, admin, first.ID); !errors.Is(err, comment.ErrNotPublisher) {
		t.Fatalf("pinning is the publisher's alone, admins included: %v", err)
	}

	if err := f.pins.Pin(ctx, alice, first.ID); err != nil {
		t.Fatal(err)
	}
	if stored, _ := f.repo.Get(ctx, first.ID); !stored.Pinned() || !stored.PinnedAt.Equal(f.now) {
		t.Fatalf("the publisher pins another user's comment: %+v", stored)
	}
	if err := f.pins.Pin(ctx, alice, second.ID); err != nil {
		t.Fatal(err)
	}
	if pinned(first.ID) || !pinned(second.ID) {
		t.Fatal("pinning another comment replaces the pinned one")
	}

	if err := f.pins.Unpin(ctx, bob, second.ID); !errors.Is(err, comment.ErrNotPublisher) {
		t.Fatalf("others cannot unpin: %v", err)
	}
	if err := f.pins.Unpin(ctx, alice, first.ID); err != nil || !pinned(second.ID) {
		t.Fatalf("unpinning a comment that is not pinned changes nothing: %v", err)
	}
	if err := f.pins.Unpin(ctx, admin, second.ID); err != nil || pinned(second.ID) {
		t.Fatalf("admins may unpin: %v", err)
	}
	if err := f.pins.Pin(ctx, alice, second.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.service.Delete(ctx, alice, second.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.pins.Pin(ctx, alice, first.ID); err != nil || !pinned(first.ID) {
		t.Fatalf("deleting the pinned comment frees the place: %v", err)
	}
}
