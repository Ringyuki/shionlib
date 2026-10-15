package walkthrough_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough/walkthroughtest"
)

const source = "新谷 灯华\n说不要去（行くなと言う） │ 灯华\n◆ Save 01\n灯华 END"

type formatFixture struct {
	clock     time.Time
	formatter *walkthroughtest.Formatter
	tasks     *walkthroughtest.FormatTasks
	quota     *walkthroughtest.FormatQuota
	queue     *moderationtest.Queue
	settings  settingtest.Source
	service   *walkthrough.FormatService
}

func newFormatFixture() *formatFixture {
	f := &formatFixture{
		clock:     time.Date(2026, 10, 15, 3, 0, 0, 0, time.UTC),
		formatter: &walkthroughtest.Formatter{},
		tasks:     walkthroughtest.NewFormatTasks(),
		quota:     walkthroughtest.NewFormatQuota(),
		queue:     &moderationtest.Queue{},
		settings:  settingtest.Source{},
	}
	serial := 0
	f.service = walkthrough.NewFormatService(walkthrough.FormatDeps{
		Games:     gametest.NewCards(game.Card{ID: gameID}),
		Cast:      walkthroughtest.Cast{Members: map[int][]walkthrough.CastMember{gameID: cast}},
		Formatter: f.formatter,
		Tasks:     f.tasks,
		Quota:     f.quota,
		Queue:     f.queue,
		Settings:  f.settings,
		Now:       func() time.Time { return f.clock },
		NewID: func() string {
			serial++
			return "task-" + strings.Repeat("0", serial)
		},
	})
	return f
}

func (f *formatFixture) start(t *testing.T) walkthrough.FormatTask {
	t.Helper()
	task, err := f.service.Start(t.Context(), author, gameID, "  "+source+"\n")
	if err != nil {
		t.Fatal(err)
	}
	return task
}

func TestFormattingIsAvailableOnlyWithAModelAndAQuota(t *testing.T) {
	f := newFormatFixture()
	if available, err := f.service.Available(t.Context()); err != nil || !available {
		t.Fatalf("available %v %v", available, err)
	}
	f.formatter.Unready = true
	if available, _ := f.service.Available(t.Context()); available {
		t.Fatal("no model, no formatting")
	}
	f.formatter.Unready = false
	settingtest.Set(f.settings, walkthrough.FormatDailyLimit, 0)
	if available, _ := f.service.Available(t.Context()); available {
		t.Fatal("a zero quota turns formatting off")
	}
}

func TestStartKeepsTheSourceOnlyInTheTaskAndQueuesIt(t *testing.T) {
	f := newFormatFixture()
	task := f.start(t)
	if task.State != walkthrough.FormatWorking || task.Text != "" || task.OwnerID != author.UserID {
		t.Fatalf("returned task %+v", task)
	}
	stored, found, _ := f.tasks.Get(t.Context(), task.ID)
	if !found || stored.Text != source || stored.GameID != gameID || !stored.Started.Equal(f.clock) || f.tasks.TTLs[task.ID] != walkthrough.FormatTaskTTL {
		t.Fatalf("stored task %+v", stored)
	}
	jobs := f.queue.All()
	if len(jobs) != 1 || jobs[0] != (walkthrough.FormatWalkthrough{TaskID: task.ID}) {
		t.Fatalf("jobs %+v", jobs)
	}
}

func TestStartRefusesWhatCannotBeFormatted(t *testing.T) {
	f := newFormatFixture()
	cases := []struct {
		gameID int
		text   string
		want   error
	}{
		{gameID, " \n ", walkthrough.ErrEmpty},
		{gameID, strings.Repeat("长", walkthrough.MaxTextLength+1), walkthrough.ErrContentTooLong},
		{404, source, game.ErrNotFound},
	}
	for _, c := range cases {
		if _, err := f.service.Start(t.Context(), author, c.gameID, c.text); !errors.Is(err, c.want) {
			t.Fatalf("%d %.10q: %v", c.gameID, c.text, err)
		}
	}
	f.formatter.Unready = true
	if _, err := f.service.Start(t.Context(), author, gameID, source); !errors.Is(err, walkthrough.ErrFormatFailed) {
		t.Fatalf("without a model: %v", err)
	}
	if len(f.queue.All()) != 0 || len(f.quota.Taken) != 0 {
		t.Fatal("a refused start neither queues nor counts")
	}
}

func TestEachUserHasADailyQuota(t *testing.T) {
	f := newFormatFixture()
	settingtest.Set(f.settings, walkthrough.FormatDailyLimit, 2)
	f.start(t)
	f.start(t)
	if _, err := f.service.Start(t.Context(), author, gameID, source); !errors.Is(err, walkthrough.ErrFormatQuotaExhausted) {
		t.Fatalf("third start: %v", err)
	}
	if _, err := f.service.Start(t.Context(), stranger, gameID, source); err != nil {
		t.Fatalf("another user: %v", err)
	}
	f.clock = f.clock.Add(24 * time.Hour)
	f.start(t)
}

func TestRunStoresTheCheckedResultAndDropsTheSource(t *testing.T) {
	f := newFormatFixture()
	f.formatter.Output = walkthrough.Formatted{Routes: []walkthrough.Route{{Key: "r1", Characters: []int{519, 7}, Ending: "灯华 END", Steps: []walkthrough.Step{
		{Kind: walkthrough.StepChoice, Text: "说不要去（行くなと言う）", Remark: "灯华"},
		{Kind: walkthrough.StepSave, Slot: "01"},
	}}}}
	task := f.start(t)
	if err := f.service.Run(t.Context(), task.ID); err != nil {
		t.Fatal(err)
	}
	if requested := f.formatter.Requested; len(requested) != 1 || requested[0].Text != source || len(requested[0].Cast) != len(cast) {
		t.Fatalf("requested %+v", requested)
	}
	result, err := f.service.Result(t.Context(), author, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	route := result.Result.Routes[0]
	if result.State != walkthrough.FormatDone || result.Text != "" || len(route.Characters) != 1 || route.Characters[0] != 519 || len(route.Steps) != 2 {
		t.Fatalf("result %+v", result)
	}
	stored, _, _ := f.tasks.Get(t.Context(), task.ID)
	if stored.Text != "" {
		t.Fatal("the source is not kept once the task ends")
	}
}

func TestAFailedRunIsReportedToItsOwner(t *testing.T) {
	f := newFormatFixture()
	f.formatter.Err = errors.New("upstream HTTP 502")
	task := f.start(t)
	if err := f.service.Run(t.Context(), task.ID); err == nil {
		t.Fatal("the job reports the failure")
	}
	if _, err := f.service.Result(t.Context(), author, task.ID); !errors.Is(err, walkthrough.ErrFormatFailed) {
		t.Fatalf("result: %v", err)
	}
	stored, _, _ := f.tasks.Get(t.Context(), task.ID)
	if stored.Text != "" || stored.Failure != "upstream HTTP 502" {
		t.Fatalf("stored %+v", stored)
	}
}

func TestResultsAreSeenOnlyByTheirOwner(t *testing.T) {
	f := newFormatFixture()
	task := f.start(t)
	if _, err := f.service.Result(t.Context(), stranger, task.ID); !errors.Is(err, walkthrough.ErrFormatTaskNotFound) {
		t.Fatalf("stranger: %v", err)
	}
	if _, err := f.service.Result(t.Context(), author, "missing"); !errors.Is(err, walkthrough.ErrFormatTaskNotFound) {
		t.Fatalf("missing: %v", err)
	}
	if working, err := f.service.Result(t.Context(), author, task.ID); err != nil || working.State != walkthrough.FormatWorking {
		t.Fatalf("working %+v %v", working, err)
	}
	f.clock = f.clock.Add(walkthrough.FormatGiveUpAfter + time.Second)
	if _, err := f.service.Result(t.Context(), author, task.ID); !errors.Is(err, walkthrough.ErrFormatFailed) {
		t.Fatalf("abandoned: %v", err)
	}
}

func TestRunSkipsTasksThatAreGoneOrFinished(t *testing.T) {
	f := newFormatFixture()
	if err := f.service.Run(context.Background(), "missing"); err != nil {
		t.Fatal(err)
	}
	task := f.start(t)
	if err := f.service.Run(t.Context(), task.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.service.Run(t.Context(), task.ID); err != nil || len(f.formatter.Requested) != 1 {
		t.Fatalf("a finished task runs once: %v %d", err, len(f.formatter.Requested))
	}
}
