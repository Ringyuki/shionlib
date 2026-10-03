package activity_test

import (
	"context"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
)

type stubRepository struct {
	created []activity.NewActivity
	filter  activity.Filter
	entries []activity.Entry
}

func (s *stubRepository) Create(_ context.Context, in activity.NewActivity) error {
	s.created = append(s.created, in)
	return nil
}

func (s *stubRepository) List(_ context.Context, filter activity.Filter, _ activity.Page) ([]activity.Entry, int, error) {
	s.filter = filter
	return slices.Clone(s.entries), len(s.entries), nil
}

func ptr[T any](v T) *T {
	return &v
}

func TestFeedFiltersByCategoryAndViewer(t *testing.T) {
	repo := &stubRepository{entries: []activity.Entry{{ID: 1, GameID: ptr(5)}, {ID: 2}}}
	cards := gametest.NewCards(game.Card{ID: 5, Covers: []game.Cover{{URL: "a"}, {URL: "b", Sexual: 1}}})
	service := activity.NewService(repo, cards)
	strict := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitNeverShow}

	entries, total, err := service.Feed(context.Background(), strict, ptr(activity.CategoryEdits), activity.Page{Number: 1, Size: 10})
	if err != nil || total != 2 {
		t.Fatalf("feed: %d %v", total, err)
	}
	if !repo.filter.ExcludeRated || !slices.Equal(repo.filter.Types, []activity.Type{activity.TypeGameEdit, activity.TypeDeveloperEdit, activity.TypeCharacterEdit}) {
		t.Fatalf("unexpected filter %+v", repo.filter)
	}
	if entries[0].Game == nil || len(entries[0].Game.Covers) != 1 || entries[1].Game != nil {
		t.Fatalf("games must be hydrated with viewer filtering: %+v", entries)
	}

	if _, _, err := service.Feed(context.Background(), actor.Actor{ContentLimit: actor.ContentLimitJustShow}, nil, activity.Page{Number: 1, Size: 10}); err != nil {
		t.Fatal(err)
	}
	if repo.filter.ExcludeRated || repo.filter.Types != nil {
		t.Fatalf("permissive viewers without a category are unfiltered: %+v", repo.filter)
	}
}

func TestRecordPassesThrough(t *testing.T) {
	repo := &stubRepository{}
	service := activity.NewService(repo, gametest.NewCards())
	in := activity.NewActivity{Type: activity.TypeComment, UserID: 3, CommentID: ptr(9)}
	if err := service.Record(context.Background(), in); err != nil {
		t.Fatal(err)
	}
	if len(repo.created) != 1 || repo.created[0].Type != activity.TypeComment || *repo.created[0].CommentID != 9 {
		t.Fatalf("unexpected recorded activity %+v", repo.created)
	}
}
