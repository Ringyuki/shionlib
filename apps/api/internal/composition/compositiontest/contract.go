package compositiontest

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type Env struct {
	Repo        composition.Repository
	NewResource func(t *testing.T) int
}

func Seed(resourceID int) composition.NewComposition {
	return composition.NewComposition{GameID: 10, CreatorID: 1, ResourceID: &resourceID, KeepPatch: true}
}

func ids(items []composition.Composition) []int {
	out := make([]int, len(items))
	for i, item := range items {
		out[i] = item.ID
	}
	return out
}

func ptr[T any](value T) *T {
	return &value
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	at := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)

	t.Run("a composition starts as a draft with what it was begun with", func(t *testing.T) {
		env := newEnv(t)
		group := download.TranslationGroup
		created, err := env.Repo.Create(ctx, composition.NewComposition{
			GameID:    10,
			CreatorID: 1,
			Base:      composition.Base{ResourceID: 31, FileIDs: []int{310, 311}, Name: "原版.part1.rar", Size: 6500, InspectionID: 71, Unpacked: 7000, Encoding: "shift_jis"},
			Details:   composition.Details{Languages: []string{"zh"}, Translation: &group, Translators: []string{"绿茶汉化组"}, PatchVersion: ptr("v1.1")},
			Placement: composition.Placement{GameDir: ptr("Game")},
			KeepPatch: true,
			Note:      ptr("第一次合成"),
		})
		if err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil || got.State != composition.StateDraft || got.GameID != 10 || got.CreatorID != 1 || got.ResourceID != nil || got.TargetFileID != nil || !got.KeepPatch || *got.Note != "第一次合成" || got.Created.IsZero() {
			t.Fatalf("draft: %+v %v", got, err)
		}
		if got.Base.ResourceID != 31 || !slices.Equal(got.Base.FileIDs, []int{310, 311}) || got.Base.Name != "原版.part1.rar" || got.Base.Size != 6500 || got.Base.InspectionID != 71 || got.Base.Unpacked != 7000 || got.Base.Encoding != "shift_jis" {
			t.Fatalf("base: %+v", got.Base)
		}
		if !slices.Equal(got.Details.Languages, []string{"zh"}) || *got.Details.Translation != group || !slices.Equal(got.Details.Translators, []string{"绿茶汉化组"}) || *got.Details.PatchVersion != "v1.1" || got.Details.ReleaseURL != nil {
			t.Fatalf("details: %+v", got.Details)
		}
		if got.Placement.GameDir == nil || *got.Placement.GameDir != "Game" || got.Placement.PatchDir != nil || got.Patch != nil || got.Save != nil || got.Plan != nil || got.Match != nil || len(got.Runs) != 0 {
			t.Fatalf("the rest is empty: %+v", got)
		}
		if _, err := env.Repo.Get(ctx, created.ID+987654); !errors.Is(err, composition.ErrNotFound) {
			t.Fatalf("a missing composition: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, created.ID+987654); !errors.Is(err, composition.ErrNotFound) {
			t.Fatalf("locking a missing composition: %v", err)
		}
		if err := env.Repo.LockQueue(ctx); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("saving keeps every fact and clears what was taken away", func(t *testing.T) {
		env := newEnv(t)
		resource := env.NewResource(t)
		created, err := env.Repo.Create(ctx, composition.NewComposition{GameID: 10, CreatorID: 1})
		if err != nil {
			t.Fatal(err)
		}
		item, err := env.Repo.Lock(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		begun := item.Created
		refusal, step, failure := composition.RefusalHarmful, composition.StepPack, composition.FailureHarmful
		old := int64(121)
		item.ResourceID, item.TargetFileID = &resource, ptr(5010)
		item.Patch = &composition.Input{Name: "补丁.zip", Size: 850, Path: "/spool/.compose/1/inputs/patch/补丁.zip", SHA256: "aa", State: composition.InputRefused, Refusal: &refusal, Viruses: []string{"Eicar"}, Encoding: "gbk", Files: 4, Unpacked: 1919}
		item.Save = &composition.Input{Name: "save.zip", Size: 36, State: composition.InputReady, Files: 2, Unpacked: 64}
		item.Placement = composition.Placement{GameDir: ptr(""), PatchDir: ptr("汉化补丁 v1.1")}
		item.KeepPatch = false
		item.Match = &composition.Match{Translators: []string{"A", "B"}, Version: ptr("V1.1"), URL: "https://www.moyu.moe/resource/1"}
		item.Plan = &composition.Plan{
			Folder: "ゲーム", GameDir: "ゲーム", PatchDir: "汉化补丁 v1.1",
			GameDirs: []composition.Dir{{Path: "", Items: 1}, {Path: "ゲーム", Items: 4}}, PatchDirs: []composition.Dir{{Path: "", Items: 1}},
			Added: []composition.Change{{Path: "chs.exe", Size: 942}}, Replaced: []composition.Change{{Path: "patch.xp3", Size: 146, OldSize: &old}}, Conflicts: []string{"save"},
			Adds: composition.Count{Files: 1, Size: 942}, Replaces: composition.Count{Files: 1, Size: 146}, Unchanged: composition.Count{Files: 3, Size: 5903}, Total: composition.Count{Files: 5, Size: 6991},
		}
		item.State, item.Step, item.Percent = composition.StateRunning, &step, 62
		item.Runs = []composition.StepRun{{Step: composition.StepFetch, Started: at, Finished: ptr(at.Add(48 * time.Second))}, {Step: composition.StepUnpack, Started: at.Add(48 * time.Second)}}
		item.Failure, item.FailureDetail = &failure, ptr("Eicar (ゲーム/chs.exe)")
		item.OutputName, item.OutputSize = "合成.7z", ptr[int64](8736)
		item.QueuedAt, item.StartedAt, item.FinishedAt = ptr(at), ptr(at.Add(time.Minute)), ptr(at.Add(time.Hour))
		item.Updated = at.Add(2 * time.Hour)
		if err := env.Repo.Save(ctx, item); err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if *got.ResourceID != resource || *got.TargetFileID != 5010 || got.KeepPatch || got.State != composition.StateRunning || *got.Step != composition.StepPack || got.Percent != 62 || *got.Failure != failure || *got.FailureDetail != "Eicar (ゲーム/chs.exe)" || got.OutputName != "合成.7z" || *got.OutputSize != 8736 {
			t.Fatalf("scalars: %+v", got)
		}
		if !got.QueuedAt.Equal(at) || !got.StartedAt.Equal(at.Add(time.Minute)) || !got.FinishedAt.Equal(at.Add(time.Hour)) || !got.Updated.Equal(at.Add(2*time.Hour)) || !got.Created.Equal(begun) {
			t.Fatalf("times: %+v", got)
		}
		patch := got.Patch
		if patch == nil || patch.Name != "补丁.zip" || patch.Size != 850 || patch.Path != item.Patch.Path || patch.SHA256 != "aa" || patch.State != composition.InputRefused || *patch.Refusal != refusal || !slices.Equal(patch.Viruses, []string{"Eicar"}) || patch.Encoding != "gbk" || patch.Files != 4 || patch.Unpacked != 1919 {
			t.Fatalf("patch: %+v", patch)
		}
		if got.Save == nil || !got.Save.Ready() || got.Save.Files != 2 || got.Save.Refusal != nil {
			t.Fatalf("save: %+v", got.Save)
		}
		if *got.Placement.GameDir != "" || *got.Placement.PatchDir != "汉化补丁 v1.1" {
			t.Fatalf("an empty place is the root, not no choice: %+v", got.Placement)
		}
		if got.Match == nil || !slices.Equal(got.Match.Translators, []string{"A", "B"}) || *got.Match.Version != "V1.1" || got.Match.URL != "https://www.moyu.moe/resource/1" {
			t.Fatalf("match: %+v", got.Match)
		}
		plan := got.Plan
		if plan == nil || plan.Folder != "ゲーム" || plan.GameDir != "ゲーム" || plan.PatchDir != "汉化补丁 v1.1" || !slices.Equal(plan.GameDirs, item.Plan.GameDirs) || !slices.Equal(plan.PatchDirs, item.Plan.PatchDirs) || !slices.Equal(plan.Conflicts, []string{"save"}) {
			t.Fatalf("plan: %+v", plan)
		}
		if len(plan.Added) != 1 || plan.Added[0] != (composition.Change{Path: "chs.exe", Size: 942}) || len(plan.Replaced) != 1 || *plan.Replaced[0].OldSize != 121 || plan.Adds != item.Plan.Adds || plan.Replaces != item.Plan.Replaces || plan.Unchanged != item.Plan.Unchanged || plan.Total != item.Plan.Total {
			t.Fatalf("changes of the plan: %+v", plan)
		}
		if len(got.Runs) != 2 || got.Runs[0].Step != composition.StepFetch || !got.Runs[0].Finished.Equal(at.Add(48*time.Second)) || got.Runs[1].Finished != nil {
			t.Fatalf("runs: %+v", got.Runs)
		}

		cleared := composition.Composition{ID: got.ID, GameID: 10, CreatorID: 1, State: composition.StateDraft, KeepPatch: true, Updated: at}
		if err := env.Repo.Save(ctx, cleared); err != nil {
			t.Fatal(err)
		}
		empty, err := env.Repo.Get(ctx, created.ID)
		if err != nil || empty.ResourceID != nil || empty.TargetFileID != nil || empty.Patch != nil || empty.Save != nil || empty.Plan != nil || empty.Match != nil || len(empty.Runs) != 0 || empty.Step != nil || empty.Failure != nil || empty.FailureDetail != nil || empty.OutputSize != nil || empty.QueuedAt != nil || empty.StartedAt != nil || empty.FinishedAt != nil || empty.Placement.GameDir != nil || empty.Placement.PatchDir != nil {
			t.Fatalf("everything taken away is gone: %+v %v", empty, err)
		}
		if err := env.Repo.SetProgress(ctx, created.ID, 37); err != nil {
			t.Fatal(err)
		}
		if moved, _ := env.Repo.Get(ctx, created.ID); moved.Percent != 37 {
			t.Fatalf("progress: %d", moved.Percent)
		}
		missing := cleared
		missing.ID += 987654
		if err := env.Repo.Save(ctx, missing); !errors.Is(err, composition.ErrNotFound) {
			t.Fatalf("saving a missing composition: %v", err)
		}
		if err := env.Repo.SetProgress(ctx, missing.ID, 1); !errors.Is(err, composition.ErrNotFound) {
			t.Fatalf("progress of a missing composition: %v", err)
		}
	})

	t.Run("the files of an input are kept apart from the composition", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.Create(ctx, composition.NewComposition{GameID: 10, CreatorID: 1})
		patch := []composition.Entry{{Path: "汉化补丁/patch.xp3", Size: 146}, {Path: "汉化补丁/chs.exe", Size: 942}}
		if err := env.Repo.SetEntries(ctx, created.ID, composition.RolePatch, patch); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SetEntries(ctx, created.ID, composition.RoleSave, []composition.Entry{{Path: "save/0.sav", Size: 32}}); err != nil {
			t.Fatal(err)
		}
		if got, err := env.Repo.Entries(ctx, created.ID, composition.RolePatch); err != nil || !slices.Equal(got, patch) {
			t.Fatalf("patch entries: %+v %v", got, err)
		}
		if got, err := env.Repo.Entries(ctx, created.ID, composition.RoleSave); err != nil || len(got) != 1 || got[0].Path != "save/0.sav" {
			t.Fatalf("save entries: %+v %v", got, err)
		}
		if err := env.Repo.SetEntries(ctx, created.ID, composition.RolePatch, nil); err != nil {
			t.Fatal(err)
		}
		if got, err := env.Repo.Entries(ctx, created.ID, composition.RolePatch); err != nil || got == nil || len(got) != 0 {
			t.Fatalf("cleared entries: %+v %v", got, err)
		}
		if got, err := env.Repo.Entries(ctx, created.ID+987654, composition.RolePatch); err != nil || len(got) != 0 {
			t.Fatalf("entries of a missing composition: %+v %v", got, err)
		}
		if err := env.Repo.SetEntries(ctx, created.ID+987654, composition.RolePatch, patch); !errors.Is(err, composition.ErrNotFound) {
			t.Fatalf("entries for a missing composition: %v", err)
		}
	})

	t.Run("compositions are listed by owner, by resource and by their place in the queue", func(t *testing.T) {
		env := newEnv(t)
		first, second := env.NewResource(t), env.NewResource(t)
		make := func(creator int, resource *int, target *int, state composition.State, queued *time.Time) composition.Composition {
			created, err := env.Repo.Create(ctx, composition.NewComposition{GameID: 10, CreatorID: creator, ResourceID: resource, TargetFileID: target})
			if err != nil {
				t.Fatal(err)
			}
			created.State, created.QueuedAt, created.Updated = state, queued, at
			if err := env.Repo.Save(ctx, created); err != nil {
				t.Fatal(err)
			}
			return created
		}
		draft := make(1, nil, nil, composition.StateDraft, nil)
		patched := make(1, nil, nil, composition.StateDraft, nil)
		patched.Patch = &composition.Input{Name: "patch.zip", State: composition.InputReady}
		saved := make(1, nil, nil, composition.StateDraft, nil)
		saved.Save = &composition.Input{Name: "save.zip", State: composition.InputReady}
		for _, holding := range []composition.Composition{patched, saved} {
			if err := env.Repo.Save(ctx, holding); err != nil {
				t.Fatal(err)
			}
		}
		done := make(1, &first, nil, composition.StateDone, nil)
		rebuilding := make(1, &first, ptr(5010), composition.StateDraft, nil)
		running := make(1, &second, nil, composition.StateRunning, ptr(at))
		early := make(1, nil, nil, composition.StateQueued, ptr(at.Add(time.Minute)))
		late := make(2, nil, nil, composition.StateQueued, ptr(at.Add(2*time.Minute)))
		tied := make(2, nil, nil, composition.StateQueued, ptr(at.Add(2*time.Minute)))
		failed := make(1, nil, nil, composition.StateFailed, nil)

		active, err := env.Repo.ListActive(ctx, 1, 10)
		if err != nil || !slices.Equal(ids(active), []int{failed.ID, early.ID, running.ID, rebuilding.ID, saved.ID, patched.ID}) {
			t.Fatalf("what a user has in hand, newest first, without drafts that hold nothing (%d) and finished work (%d): %v %v", draft.ID, done.ID, ids(active), err)
		}
		if few, _ := env.Repo.ListActive(ctx, 1, 2); !slices.Equal(ids(few), []int{failed.ID, early.ID}) {
			t.Fatalf("limited: %v", ids(few))
		}
		of, err := env.Repo.OfResource(ctx, first)
		if err != nil || !slices.Equal(ids(of), []int{rebuilding.ID, done.ID}) {
			t.Fatalf("the compositions of a resource, newest first: %v %v", ids(of), err)
		}
		composed, err := env.Repo.Composed(ctx, []int{first, second, second + 987654})
		if err != nil || !slices.Equal(composed, []int{first, second}) {
			t.Fatalf("composed resources: %v %v", composed, err)
		}
		if none, err := env.Repo.Composed(ctx, nil); err != nil || len(none) != 0 {
			t.Fatalf("no resources asked: %v %v", none, err)
		}
		if queued, err := env.Repo.CountQueued(ctx); err != nil || queued != 3 {
			t.Fatalf("queued: %d %v", queued, err)
		}
		if count, err := env.Repo.CountRunning(ctx); err != nil || count != 1 {
			t.Fatalf("running: %d %v", count, err)
		}
		reading := draft
		reading.Save = &composition.Input{Name: "save.zip", State: composition.InputReading}
		reading.Patch = &composition.Input{Name: "patch.zip", State: composition.InputReady}
		reading.Updated = at
		if err := env.Repo.Save(ctx, reading); err != nil {
			t.Fatal(err)
		}
		unsettled, err := env.Repo.Unsettled(ctx, 10)
		if err != nil || !slices.Equal(ids(unsettled), []int{draft.ID, running.ID, early.ID, late.ID, tied.ID}) {
			t.Fatalf("what still has work to be done, oldest first: %v %v", ids(unsettled), err)
		}
		if few, _ := env.Repo.Unsettled(ctx, 2); len(few) != 2 {
			t.Fatalf("limited: %v", ids(few))
		}
		for id, want := range map[int]int{early.ID: 1, late.ID: 2, tied.ID: 3, draft.ID: 0, tied.ID + 987654: 0} {
			if ahead, err := env.Repo.Ahead(ctx, id); err != nil || ahead != want {
				t.Fatalf("ahead of %d: %d %v, want %d", id, ahead, err, want)
			}
		}
	})

	t.Run("stale drafts are found and compositions are deleted", func(t *testing.T) {
		env := newEnv(t)
		age := func(state composition.State, updated time.Time) int {
			created, err := env.Repo.Create(ctx, composition.NewComposition{GameID: 10, CreatorID: 1})
			if err != nil {
				t.Fatal(err)
			}
			created.State, created.Updated = state, updated
			if err := env.Repo.Save(ctx, created); err != nil {
				t.Fatal(err)
			}
			return created.ID
		}
		old, older := age(composition.StateDraft, at.Add(-25*time.Hour)), age(composition.StateDraft, at.Add(-48*time.Hour))
		fresh := age(composition.StateDraft, at.Add(-time.Hour))
		queued := age(composition.StateQueued, at.Add(-72*time.Hour))
		stale, err := env.Repo.StaleDrafts(ctx, at.Add(-24*time.Hour), 10)
		if err != nil || !slices.Equal(stale, []int{old, older}) {
			t.Fatalf("drafts untouched for a day, not %d or %d: %v %v", fresh, queued, stale, err)
		}
		if one, _ := env.Repo.StaleDrafts(ctx, at.Add(-24*time.Hour), 1); len(one) != 1 {
			t.Fatalf("limited: %v", one)
		}
		if err := env.Repo.Delete(ctx, old); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.Delete(ctx, old); !errors.Is(err, composition.ErrNotFound) {
			t.Fatalf("deleting twice: %v", err)
		}
		existing, err := env.Repo.Existing(ctx, []int{old, older, fresh, fresh + 987654})
		if err != nil || !slices.Equal(existing, []int{older, fresh}) {
			t.Fatalf("existing: %v %v", existing, err)
		}
		if none, err := env.Repo.Existing(ctx, nil); err != nil || len(none) != 0 {
			t.Fatalf("nothing asked: %v %v", none, err)
		}
	})
}
