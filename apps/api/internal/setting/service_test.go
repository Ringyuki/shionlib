package setting_test

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

func errorsIs(err, target error) bool {
	return errors.Is(err, target)
}

func TestReloadServesStoredValuesAndSkipsUnknownOrInvalidOnes(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	_ = f.repo.Save(ctx, "fixture.limit", json.RawMessage(`25`))
	_ = f.repo.Save(ctx, "fixture.window", json.RawMessage(`120`))
	_ = f.repo.Save(ctx, "fixture.weight", json.RawMessage(`99`))
	_ = f.repo.Save(ctx, "fixture.retired", json.RawMessage(`1`))
	if testLimit.Read(f.service) != 10 {
		t.Fatal("before the first reload the defaults apply")
	}
	if err := f.service.Reload(ctx); err != nil {
		t.Fatal(err)
	}
	if testLimit.Read(f.service) != 25 || testWindow.Read(f.service) != 2*time.Minute || testWeight.Read(f.service) != 0.6 {
		t.Fatalf("reloaded: limit=%d window=%s weight=%g", testLimit.Read(f.service), testWindow.Read(f.service), testWeight.Read(f.service))
	}
	if _, ok := f.service.Lookup("fixture.retired"); ok {
		t.Fatal("values of undeclared keys are ignored")
	}
}

func TestUpdateStoresTheNormalizedValueAndRecordsTheChange(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	entry, err := f.service.Update(ctx, superAdmin, "fixture.weight", json.RawMessage(`2.50`))
	if err != nil {
		t.Fatal(err)
	}
	if string(entry.Value) != "2.5" || !entry.Overridden || entry.LastChange == nil || entry.LastChange.Editor == nil || entry.LastChange.Editor.Name != "shion" {
		t.Fatalf("entry: %+v", entry)
	}
	if testWeight.Read(f.service) != 2.5 || f.announcer.Calls() != 1 {
		t.Fatalf("the change is served at once and announced: weight=%g announcements=%d", testWeight.Read(f.service), f.announcer.Calls())
	}
	if _, err := f.service.Update(ctx, superAdmin, "fixture.weight", json.RawMessage(`3`)); err != nil {
		t.Fatal(err)
	}
	changes, total, err := f.service.History(ctx, "fixture.weight", paging.Page{Number: 1, Size: 10})
	if err != nil || total != 2 {
		t.Fatalf("history: %+v %d %v", changes, total, err)
	}
	if string(changes[0].Previous) != "2.5" || string(changes[0].Value) != "3" || changes[0].Editor == nil || changes[0].Editor.ID != superAdmin.UserID {
		t.Fatalf("newest change: %+v", changes[0])
	}
	if changes[1].Previous != nil || string(changes[1].Value) != "2.5" {
		t.Fatalf("the first change starts from the default: %+v", changes[1])
	}
}

func TestUpdateWithTheSameValueRecordsNothing(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	if _, err := f.service.Update(ctx, superAdmin, "fixture.limit", json.RawMessage(`20`)); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.Update(ctx, superAdmin, "fixture.limit", json.RawMessage(` 20`)); err != nil {
		t.Fatal(err)
	}
	if _, total, _ := f.service.History(ctx, "fixture.limit", paging.Page{Number: 1, Size: 10}); total != 1 || f.announcer.Calls() != 1 {
		t.Fatalf("history=%d announcements=%d", total, f.announcer.Calls())
	}
}

func TestUpdateRejectsUnknownKeysAndInvalidValues(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	if _, err := f.service.Update(ctx, superAdmin, "fixture.nothing", json.RawMessage(`1`)); !errors.Is(err, setting.ErrNotFound) {
		t.Fatalf("unknown key: %v", err)
	}
	if _, err := f.service.Update(ctx, superAdmin, "fixture.limit", json.RawMessage(`1000`)); !errors.Is(err, setting.ErrInvalidValue) {
		t.Fatalf("out of range: %v", err)
	}
	if values, _ := f.repo.Values(ctx); len(values) != 0 || f.announcer.Calls() != 0 {
		t.Fatalf("nothing is stored: %+v", values)
	}
}

func TestResetReturnsToTheDefault(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	if _, err := f.service.Update(ctx, superAdmin, "fixture.open", json.RawMessage(`false`)); err != nil {
		t.Fatal(err)
	}
	entry, err := f.service.Reset(ctx, superAdmin, "fixture.open")
	if err != nil {
		t.Fatal(err)
	}
	if entry.Overridden || string(entry.Value) != "true" || !testOpen.Read(f.service) || f.announcer.Calls() != 2 {
		t.Fatalf("entry=%+v announcements=%d", entry, f.announcer.Calls())
	}
	if entry.LastChange == nil || entry.LastChange.Value != nil || string(entry.LastChange.Previous) != "false" {
		t.Fatalf("reset change: %+v", entry.LastChange)
	}
	if _, err := f.service.Reset(ctx, superAdmin, "fixture.open"); err != nil {
		t.Fatal(err)
	}
	if _, total, _ := f.service.History(ctx, "fixture.open", paging.Page{Number: 1, Size: 10}); total != 2 || f.announcer.Calls() != 2 {
		t.Fatalf("resetting a default is a no-op: history=%d announcements=%d", total, f.announcer.Calls())
	}
	if _, err := f.service.Reset(ctx, superAdmin, "fixture.nothing"); !errors.Is(err, setting.ErrNotFound) {
		t.Fatalf("unknown key: %v", err)
	}
}

func TestListShowsEveryDeclaredKey(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	if _, err := f.service.Update(ctx, superAdmin, "fixture.quota", json.RawMessage(`1024`)); err != nil {
		t.Fatal(err)
	}
	_ = f.repo.Save(ctx, "fixture.limit", json.RawMessage(`500`))
	entries, err := f.service.List(ctx)
	if err != nil || len(entries) != len(setting.Definitions()) {
		t.Fatalf("list: %d entries, %v", len(entries), err)
	}
	byName := map[string]setting.Entry{}
	for _, entry := range entries {
		byName[entry.Name] = entry
	}
	quota := byName["fixture.quota"]
	if !quota.Overridden || string(quota.Value) != "1024" || quota.LastChange == nil || string(quota.LastChange.Value) != "1024" {
		t.Fatalf("quota: %+v", quota)
	}
	if limit := byName["fixture.limit"]; limit.Overridden || string(limit.Value) != "10" {
		t.Fatalf("a stored value outside the bounds falls back to the default: %+v", limit)
	}
	if note := byName["fixture.note"]; note.Overridden || note.LastChange != nil || string(note.Value) != `"默认"` {
		t.Fatalf("note: %+v", note)
	}
}

func TestHistoryOfUnknownKeysIsNotFound(t *testing.T) {
	f := newFixture(t)
	if _, _, err := f.service.History(t.Context(), "fixture.nothing", paging.Page{Number: 1, Size: 10}); !errors.Is(err, setting.ErrNotFound) {
		t.Fatalf("history: %v", err)
	}
	if _, err := f.service.Get(t.Context(), "fixture.nothing"); !errors.Is(err, setting.ErrNotFound) {
		t.Fatalf("get: %v", err)
	}
}
