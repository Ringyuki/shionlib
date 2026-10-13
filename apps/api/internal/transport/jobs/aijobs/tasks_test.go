package aijobs_test

import (
	"context"
	"slices"
	"testing"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/aijobs"
)

type maintenance struct {
	calls []string
}

func (m *maintenance) ProbeSuspended(context.Context) error {
	m.calls = append(m.calls, "probe")
	return nil
}

func (m *maintenance) SyncIfStale(context.Context) error {
	m.calls = append(m.calls, "catalog")
	return nil
}

func (m *maintenance) SyncOffers(context.Context) error {
	m.calls = append(m.calls, "offers")
	return nil
}

func (m *maintenance) Purge(context.Context) error {
	m.calls = append(m.calls, "purge")
	return nil
}

func TestTasksRunTheGatewayMaintenance(t *testing.T) {
	m := &maintenance{}
	tasks := aijobs.Tasks(aijobs.TaskDeps{Prober: m, Catalog: m, Offers: m, Usage: m})
	names := map[string]string{}
	for _, task := range tasks {
		names[task.Name] = task.Schedule
		if task.Timeout <= 0 {
			t.Fatalf("task %s has no timeout", task.Name)
		}
		if err := task.Run(t.Context()); err != nil {
			t.Fatal(err)
		}
	}
	if names["ai_probe_suspended_routes"] != "*/10 * * * *" || names["ai_sync_catalog"] != "17 * * * *" || names["ai_sync_offers"] != "0 6 * * *" || names["ai_purge_requests"] != "0 4 * * *" {
		t.Fatalf("schedules %v", names)
	}
	if !slices.Equal(m.calls, []string{"probe", "catalog", "offers", "purge"}) {
		t.Fatalf("calls %v", m.calls)
	}
	aijobs.Register(&announcer{})(river.NewWorkers())
}
