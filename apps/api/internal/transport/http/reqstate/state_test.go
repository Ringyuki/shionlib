package reqstate_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reqstate"
)

func TestRecordsReachTheAccessLogSnapshot(t *testing.T) {
	ctx, state := reqstate.With(context.Background())
	cause := errors.New("boom")
	reqstate.RecordRoute(ctx, "/favorites/{id}")
	reqstate.RecordUser(ctx, 7)
	reqstate.RecordError(ctx, 460101, cause)
	snapshot := state.Snapshot()
	if snapshot.Route != "/favorites/{id}" || snapshot.BizCode != 460101 || !errors.Is(snapshot.Err, cause) || !snapshot.HasError || state.UserID() != 7 {
		t.Fatalf("snapshot %+v user %d", snapshot, state.UserID())
	}
	if reqstate.From(ctx) != state {
		t.Fatal("the state travels with the context")
	}
}

func TestRecordingWithoutStateIsANoOp(t *testing.T) {
	ctx := context.Background()
	reqstate.RecordRoute(ctx, "/x")
	reqstate.RecordUser(ctx, 1)
	reqstate.RecordError(ctx, 1, errors.New("x"))
	if reqstate.From(ctx) != nil {
		t.Fatal("no state was attached")
	}
}
