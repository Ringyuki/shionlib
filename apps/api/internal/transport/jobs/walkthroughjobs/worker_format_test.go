package walkthroughjobs_test

import (
	"context"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/walkthroughjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough/walkthroughtest"
)

func TestFormatWorkerRunsTheQueuedTask(t *testing.T) {
	tasks := walkthroughtest.NewFormatTasks()
	formatter := &walkthroughtest.Formatter{Output: walkthrough.Formatted{Routes: []walkthrough.Route{{Key: "r1", Name: "ハーレム", Steps: []walkthrough.Step{{Kind: walkthrough.StepLoad, Slot: "01"}}}}}}
	queue := &moderationtest.Queue{}
	formats := walkthrough.NewFormatService(walkthrough.FormatDeps{
		Games:     gametest.NewCards(game.Card{ID: 46}),
		Cast:      walkthroughtest.Cast{},
		Formatter: formatter,
		Tasks:     tasks,
		Quota:     walkthroughtest.NewFormatQuota(),
		Queue:     queue,
		Settings:  settingtest.Source{},
		Now:       time.Now,
		NewID:     func() string { return "task" },
	})
	owner := actor.Actor{UserID: 9, Role: actor.RoleUser}
	task, err := formats.Start(t.Context(), owner, 46, "ハーレム\n◆ Load 01")
	if err != nil {
		t.Fatal(err)
	}
	worker := walkthroughjobs.NewFormatWorker(formats)
	job := &river.Job[walkthrough.FormatWalkthrough]{JobRow: &rivertype.JobRow{}, Args: walkthrough.FormatWalkthrough{TaskID: task.ID}}
	if err := worker.Work(context.Background(), job); err != nil {
		t.Fatal(err)
	}
	done, err := formats.Result(t.Context(), owner, task.ID)
	if err != nil || done.State != walkthrough.FormatDone || len(done.Result.Routes) != 1 {
		t.Fatalf("result %+v %v", done, err)
	}
	if worker.Timeout(job) <= 10*time.Minute {
		t.Fatal("the job outlasts the longest model call")
	}
	if (walkthrough.FormatWalkthrough{}).Kind() != "walkthrough_format" || (walkthrough.FormatWalkthrough{}).MaxAttempts() != 1 {
		t.Fatal("job kind or attempts changed")
	}
}
