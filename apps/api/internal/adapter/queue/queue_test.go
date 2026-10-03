package queue_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
)

type plainJob struct{}

func (plainJob) Kind() string { return "plain" }

type routedJob struct{}

func (routedJob) Kind() string { return "routed" }

func (routedJob) Queue() string { return "file_transfer" }

func (routedJob) MaxAttempts() int { return 5 }

type limitedJob struct{}

func (limitedJob) Kind() string { return "limited" }

func (limitedJob) MaxAttempts() int { return 10 }

func TestInsertOptions(t *testing.T) {
	if opts := queue.InsertOptions(plainJob{}); opts != nil {
		t.Fatalf("plain jobs keep River defaults: %+v", opts)
	}
	routed := queue.InsertOptions(routedJob{})
	if routed == nil || routed.Queue != "file_transfer" || routed.MaxAttempts != 5 {
		t.Fatalf("routed: %+v", routed)
	}
	limited := queue.InsertOptions(limitedJob{})
	if limited == nil || limited.Queue != "" || limited.MaxAttempts != 10 {
		t.Fatalf("limited: %+v", limited)
	}
}
