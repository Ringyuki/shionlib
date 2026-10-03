package queue_test

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

type plainJob struct {
	N int `json:"n"`
}

func (plainJob) Kind() string {
	return "plain_job"
}

func TestEnqueueHonorsJobCapabilities(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	pool, err := pgxpool.New(ctx, db.URL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := jobs.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	inserter, err := jobs.NewInserter(pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	q := queue.New(inserter)
	job := catalog.ImportJob{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "77"}
	for range 3 {
		if err := q.Enqueue(ctx, job); err != nil {
			t.Fatal(err)
		}
	}
	if err := q.Enqueue(ctx, catalog.ImportJob{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "78"}); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := q.Enqueue(ctx, plainJob{N: 1}); err != nil {
			t.Fatal(err)
		}
	}
	type row struct {
		kind, queue string
		attempts    int
	}
	rows, err := pool.Query(ctx, `SELECT kind, queue, max_attempts FROM river_job ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var got []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.kind, &r.queue, &r.attempts); err != nil {
			t.Fatal(err)
		}
		got = append(got, r)
	}
	want := []row{
		{kind: "catalog_import", queue: "catalog", attempts: 5},
		{kind: "catalog_import", queue: "catalog", attempts: 5},
		{kind: "plain_job", queue: "default", attempts: 25},
		{kind: "plain_job", queue: "default", attempts: 25},
	}
	if len(got) != len(want) {
		t.Fatalf("rows %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("row %d: %+v, want %+v", i, got[i], want[i])
		}
	}
}
