package aijobs_test

import (
	"context"
	"errors"
	"testing"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/aijobs"
)

type announcer struct {
	notices []ai.RouteStatusNotice
	err     error
}

func (a *announcer) Announce(_ context.Context, notice ai.RouteStatusNotice) error {
	a.notices = append(a.notices, notice)
	return a.err
}

func TestRouteStatusWorkerAnnouncesTheNotice(t *testing.T) {
	a := &announcer{}
	worker := aijobs.NewRouteStatusWorker(a)
	notice := ai.RouteStatusNotice{RouteID: 7, Suspended: true}
	if err := worker.Work(t.Context(), &river.Job[ai.RouteStatusNotice]{Args: notice}); err != nil {
		t.Fatal(err)
	}
	if len(a.notices) != 1 || a.notices[0] != notice || worker.Timeout(nil) <= 0 {
		t.Fatalf("notices %+v", a.notices)
	}
	a.err = errors.New("db down")
	if err := worker.Work(t.Context(), &river.Job[ai.RouteStatusNotice]{Args: notice}); !errors.Is(err, a.err) {
		t.Fatalf("failures are retried: %v", err)
	}
	if (ai.RouteStatusNotice{}).Kind() != "ai_route_status" {
		t.Fatal("job kind changed")
	}
}
