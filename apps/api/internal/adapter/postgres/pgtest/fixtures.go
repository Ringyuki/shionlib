package pgtest

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
)

var sequence atomic.Int64

func next() int64 {
	return sequence.Add(1)
}

func (db *DB) User(t *testing.T) int {
	t.Helper()
	n := next()
	user, err := db.Ent.User.Create().
		SetName(fmt.Sprintf("user%d", n)).
		SetEmail(fmt.Sprintf("user%d@example.test", n)).
		SetContentLimit(1).
		Save(context.Background())
	if err != nil {
		t.Fatalf("create user fixture: %v", err)
	}
	return user.ID
}

func (db *DB) Game(t *testing.T, mutate ...func(*ent.GameCreate)) int {
	t.Helper()
	creator := db.User(t)
	create := db.Ent.Game.Create().
		SetTitleJp(fmt.Sprintf("ゲーム%d", next())).
		SetCreatorID(creator)
	for _, fn := range mutate {
		fn(create)
	}
	row, err := create.Save(context.Background())
	if err != nil {
		t.Fatalf("create game fixture: %v", err)
	}
	return row.ID
}
