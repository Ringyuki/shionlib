package indexingjobs_test

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/indexingjobs"
)

type cursor struct{ saved []time.Time }

func (c *cursor) Load(context.Context) (time.Time, bool, error) { return time.Time{}, false, nil }

func (c *cursor) Save(_ context.Context, at time.Time) error {
	c.saved = append(c.saved, at)
	return nil
}

func TestPushTaskRunsEveryTenMinutes(t *testing.T) {
	now := time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC)
	c := &cursor{}
	settings := settingtest.Set(settingtest.Source{}, indexing.Enabled, true)
	service := indexing.NewService(nil, nil, c, settings, indexing.Options{}, func() time.Time { return now })
	task := indexingjobs.PushTask(service, slog.New(slog.DiscardHandler))
	if task.Name != "indexing.push" || task.Schedule != "*/10 * * * *" || task.Timeout <= 0 {
		t.Fatalf("task %+v", task)
	}
	if err := task.Run(t.Context()); err != nil || len(c.saved) != 1 || !c.saved[0].Equal(now) {
		t.Fatalf("the first run marks where to start: %v %v", c.saved, err)
	}
}
