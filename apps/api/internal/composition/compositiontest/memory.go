package compositiontest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

type MemoryRepository struct {
	mu      sync.Mutex
	nextID  int
	items   map[int]composition.Composition
	entries map[int]map[composition.Role][]composition.Entry
	now     func() time.Time
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{items: map[int]composition.Composition{}, entries: map[int]map[composition.Role][]composition.Entry{}, now: now}
}

func Clone(item composition.Composition) composition.Composition {
	item.ResourceID = cloned(item.ResourceID)
	item.TargetFileID = cloned(item.TargetFileID)
	item.Base.FileIDs = slices.Clone(item.Base.FileIDs)
	item.Patch = clonedInput(item.Patch)
	item.Save = clonedInput(item.Save)
	item.Placement = composition.Placement{GameDir: cloned(item.Placement.GameDir), PatchDir: cloned(item.Placement.PatchDir)}
	item.Details.Languages = slices.Clone(item.Details.Languages)
	item.Details.Translators = slices.Clone(item.Details.Translators)
	item.Details.Translation = cloned(item.Details.Translation)
	item.Details.PatchVersion = cloned(item.Details.PatchVersion)
	item.Details.ReleaseURL = cloned(item.Details.ReleaseURL)
	item.Note = cloned(item.Note)
	item.Match = cloned(item.Match)
	if item.Plan != nil {
		plan := *item.Plan
		plan.Added, plan.Replaced, plan.Conflicts = slices.Clone(plan.Added), slices.Clone(plan.Replaced), slices.Clone(plan.Conflicts)
		plan.GameDirs, plan.PatchDirs = slices.Clone(plan.GameDirs), slices.Clone(plan.PatchDirs)
		item.Plan = &plan
	}
	item.Step = cloned(item.Step)
	item.Runs = slices.Clone(item.Runs)
	item.Failure = cloned(item.Failure)
	item.FailureDetail = cloned(item.FailureDetail)
	item.OutputSize = cloned(item.OutputSize)
	item.QueuedAt, item.StartedAt, item.FinishedAt = cloned(item.QueuedAt), cloned(item.StartedAt), cloned(item.FinishedAt)
	return item
}

func cloned[T any](value *T) *T {
	if value == nil {
		return nil
	}
	copied := *value
	return &copied
}

func clonedInput(input *composition.Input) *composition.Input {
	if input == nil {
		return nil
	}
	copied := *input
	copied.Refusal = cloned(input.Refusal)
	copied.Viruses = slices.Clone(input.Viruses)
	return &copied
}

func (r *MemoryRepository) Create(_ context.Context, in composition.NewComposition) (composition.Composition, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	now := r.now()
	item := composition.Composition{
		ID:           r.nextID,
		GameID:       in.GameID,
		CreatorID:    in.CreatorID,
		ResourceID:   in.ResourceID,
		TargetFileID: in.TargetFileID,
		Base:         in.Base,
		Details:      in.Details,
		Placement:    in.Placement,
		KeepPatch:    in.KeepPatch,
		Note:         in.Note,
		State:        composition.StateDraft,
		Created:      now,
		Updated:      now,
	}
	r.items[item.ID] = Clone(item)
	return Clone(item), nil
}

func (r *MemoryRepository) Get(_ context.Context, id int) (composition.Composition, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return composition.Composition{}, composition.ErrNotFound
	}
	return Clone(item), nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (composition.Composition, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) LockQueue(context.Context) error {
	return nil
}

func (r *MemoryRepository) Save(_ context.Context, item composition.Composition) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.items[item.ID]
	if !ok {
		return composition.ErrNotFound
	}
	item.Created = stored.Created
	r.items[item.ID] = Clone(item)
	return nil
}

func (r *MemoryRepository) SetProgress(_ context.Context, id int, percent int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return composition.ErrNotFound
	}
	item.Percent = percent
	r.items[id] = item
	return nil
}

func (r *MemoryRepository) SetEntries(_ context.Context, id int, role composition.Role, entries []composition.Entry) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return composition.ErrNotFound
	}
	if r.entries[id] == nil {
		r.entries[id] = map[composition.Role][]composition.Entry{}
	}
	r.entries[id][role] = slices.Clone(entries)
	return nil
}

func (r *MemoryRepository) Entries(_ context.Context, id int, role composition.Role) ([]composition.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]composition.Entry{}, r.entries[id][role]...), nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return composition.ErrNotFound
	}
	delete(r.items, id)
	delete(r.entries, id)
	return nil
}

func (r *MemoryRepository) selected(keep func(item composition.Composition) bool) []composition.Composition {
	found := []composition.Composition{}
	for _, item := range r.items {
		if keep(item) {
			found = append(found, Clone(item))
		}
	}
	slices.SortFunc(found, func(a, b composition.Composition) int { return cmp.Compare(b.ID, a.ID) })
	return found
}

func (r *MemoryRepository) ListActive(_ context.Context, creatorID, limit int) ([]composition.Composition, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	found := r.selected(func(item composition.Composition) bool {
		return item.CreatorID == creatorID && (item.Active() || item.State == composition.StateFailed || (item.State == composition.StateDraft && (item.Rebuild() || item.Patch != nil || item.Save != nil)))
	})
	return found[:min(len(found), limit)], nil
}

func (r *MemoryRepository) OfResource(_ context.Context, resourceID int) ([]composition.Composition, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.selected(func(item composition.Composition) bool {
		return item.ResourceID != nil && *item.ResourceID == resourceID
	}), nil
}

func (r *MemoryRepository) Composed(_ context.Context, resourceIDs []int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	composed := []int{}
	for _, item := range r.items {
		if item.ResourceID != nil && slices.Contains(resourceIDs, *item.ResourceID) && !slices.Contains(composed, *item.ResourceID) {
			composed = append(composed, *item.ResourceID)
		}
	}
	slices.Sort(composed)
	return composed, nil
}

func (r *MemoryRepository) count(state composition.State) int {
	return len(r.selected(func(item composition.Composition) bool { return item.State == state }))
}

func (r *MemoryRepository) CountQueued(context.Context) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.count(composition.StateQueued), nil
}

func (r *MemoryRepository) CountRunning(context.Context) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.count(composition.StateRunning), nil
}

func (r *MemoryRepository) Ahead(_ context.Context, id int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	target, ok := r.items[id]
	if !ok || target.QueuedAt == nil {
		return 0, nil
	}
	return len(r.selected(func(item composition.Composition) bool {
		if item.State == composition.StateRunning {
			return true
		}
		return item.State == composition.StateQueued && item.ID != id && item.QueuedAt != nil &&
			(item.QueuedAt.Before(*target.QueuedAt) || (item.QueuedAt.Equal(*target.QueuedAt) && item.ID < id))
	})), nil
}

func (r *MemoryRepository) StaleDrafts(_ context.Context, before time.Time, limit int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	stale := r.selected(func(item composition.Composition) bool {
		return item.State == composition.StateDraft && item.Updated.Before(before)
	})
	ids := []int{}
	for _, item := range stale[:min(len(stale), limit)] {
		ids = append(ids, item.ID)
	}
	slices.Sort(ids)
	return ids, nil
}

func (r *MemoryRepository) Unsettled(_ context.Context, limit int) ([]composition.Composition, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	reading := func(input *composition.Input) bool { return input != nil && input.State == composition.InputReading }
	found := r.selected(func(item composition.Composition) bool {
		return item.Active() || (item.State == composition.StateDraft && (reading(item.Patch) || reading(item.Save)))
	})
	slices.Reverse(found)
	return found[:min(len(found), limit)], nil
}

func (r *MemoryRepository) Existing(_ context.Context, ids []int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	existing := []int{}
	for _, id := range ids {
		if _, ok := r.items[id]; ok {
			existing = append(existing, id)
		}
	}
	return existing, nil
}
