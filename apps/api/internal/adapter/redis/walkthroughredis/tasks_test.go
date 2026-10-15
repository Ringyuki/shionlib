package walkthroughredis_test

import (
	"reflect"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/walkthroughredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

func TestATaskComesBackAsSavedUntilItExpires(t *testing.T) {
	client := redistest.New(t)
	store := walkthroughredis.NewFormatTaskStore(client)
	task := walkthrough.FormatTask{
		ID:      "0b9c",
		OwnerID: 9,
		GameID:  46,
		State:   walkthrough.FormatDone,
		Started: time.Date(2026, 10, 15, 3, 0, 0, 0, time.UTC),
		Result: walkthrough.Formatted{
			Note: []string{"通关一次后即可直接进入"},
			Routes: []walkthrough.Route{
				{Key: "r1", Characters: []int{519}, Requires: []string{}, Ending: "灯华 END", Steps: []walkthrough.Step{
					{Kind: walkthrough.StepChoice, Text: "说不要去", Remark: "灯华"},
					{Kind: walkthrough.StepSave, Slot: "01"},
					{Kind: walkthrough.StepGap},
				}},
				{Key: "r2", Name: "ハーレム", Characters: []int{}, Requires: []string{"r1"}, Condition: "全员通关后", Steps: []walkthrough.Step{}},
			},
		},
	}
	if err := store.Save(t.Context(), task, time.Hour); err != nil {
		t.Fatal(err)
	}
	loaded, found, err := store.Get(t.Context(), task.ID)
	if err != nil || !found {
		t.Fatalf("load %v %v", found, err)
	}
	if !reflect.DeepEqual(loaded, task) {
		t.Fatalf("loaded\n got %+v\nwant %+v", loaded, task)
	}
	if ttl := client.TTL(t.Context(), client.Key("walkthrough", "format", "task", task.ID)).Val(); ttl <= 0 || ttl > time.Hour {
		t.Fatalf("ttl %v", ttl)
	}
	if _, found, err := store.Get(t.Context(), "missing"); err != nil || found {
		t.Fatalf("missing %v %v", found, err)
	}
}

func TestTheQuotaCountsPerUserAndDay(t *testing.T) {
	client := redistest.New(t)
	quota := walkthroughredis.NewFormatQuota(client)
	for i, want := range []bool{true, true, false} {
		if allowed, err := quota.Take(t.Context(), 9, "2026-10-15", 2); err != nil || allowed != want {
			t.Fatalf("take %d: %v %v", i, allowed, err)
		}
	}
	if allowed, _ := quota.Take(t.Context(), 10, "2026-10-15", 2); !allowed {
		t.Fatal("another user has their own quota")
	}
	if allowed, _ := quota.Take(t.Context(), 9, "2026-10-16", 2); !allowed {
		t.Fatal("the next day starts again")
	}
	if ttl := client.TTL(t.Context(), client.Key("walkthrough", "format", "quota", "2026-10-15", "9")).Val(); ttl <= 0 || ttl > 48*time.Hour {
		t.Fatalf("ttl %v", ttl)
	}
}
