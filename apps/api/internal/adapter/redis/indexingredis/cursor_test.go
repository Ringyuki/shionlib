package indexingredis_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/indexingredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

var _ indexing.Cursor = (*indexingredis.Cursor)(nil)

func TestCursorRemembersWhereThePushStopped(t *testing.T) {
	client := redistest.New(t)
	ctx := context.Background()
	cursor := indexingredis.NewCursor(client)
	if _, found, err := cursor.Load(ctx); err != nil || found {
		t.Fatalf("no cursor yet: %v %v", found, err)
	}
	at := time.Date(2026, 10, 14, 12, 0, 0, 123000000, time.UTC)
	if err := cursor.Save(ctx, at); err != nil {
		t.Fatal(err)
	}
	if got, found, err := cursor.Load(ctx); err != nil || !found || !got.Equal(at) {
		t.Fatalf("got %v %v %v", got, found, err)
	}
}
