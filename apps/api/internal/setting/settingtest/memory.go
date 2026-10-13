package settingtest

import (
	"cmp"
	"context"
	"encoding/json"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type MemoryRepository struct {
	mu      sync.Mutex
	now     func() time.Time
	nextID  int
	values  map[string]setting.StoredValue
	changes []setting.Change
	editors map[int]string
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{now: now, values: map[string]setting.StoredValue{}, editors: map[int]string{}}
}

func (r *MemoryRepository) AddEditor(id int, name string) setting.Editor {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.editors[id] = name
	return setting.Editor{ID: id, Name: name}
}

func (r *MemoryRepository) Values(context.Context) ([]setting.StoredValue, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]setting.StoredValue, 0, len(r.values))
	for _, value := range r.values {
		out = append(out, value)
	}
	slices.SortFunc(out, func(a, b setting.StoredValue) int { return cmp.Compare(a.Name, b.Name) })
	return out, nil
}

func (r *MemoryRepository) Value(_ context.Context, name string) (setting.StoredValue, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	value, ok := r.values[name]
	return value, ok, nil
}

func (r *MemoryRepository) Save(_ context.Context, name string, value json.RawMessage) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.values[name] = setting.StoredValue{Name: name, Value: slices.Clone(value), Updated: r.now()}
	return nil
}

func (r *MemoryRepository) Remove(_ context.Context, name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.values, name)
	return nil
}

func (r *MemoryRepository) Record(_ context.Context, change setting.NewChange) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	recorded := setting.Change{
		ID:       r.nextID,
		Name:     change.Name,
		Previous: slices.Clone(change.Previous),
		Value:    slices.Clone(change.Value),
		Created:  r.now(),
	}
	if name, ok := r.editors[change.EditorID]; ok {
		recorded.Editor = &setting.Editor{ID: change.EditorID, Name: name}
	}
	r.changes = append(r.changes, recorded)
	return nil
}

func (r *MemoryRepository) LatestChanges(context.Context) ([]setting.Change, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	latest := map[string]setting.Change{}
	for _, change := range r.changes {
		latest[change.Name] = change
	}
	out := make([]setting.Change, 0, len(latest))
	for _, change := range latest {
		out = append(out, change)
	}
	slices.SortFunc(out, func(a, b setting.Change) int { return cmp.Compare(a.Name, b.Name) })
	return out, nil
}

func (r *MemoryRepository) Changes(_ context.Context, name string, page paging.Page) ([]setting.Change, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var matched []setting.Change
	for i := len(r.changes) - 1; i >= 0; i-- {
		if r.changes[i].Name == name {
			matched = append(matched, r.changes[i])
		}
	}
	start := min(page.Offset(), len(matched))
	end := min(start+page.Size, len(matched))
	return matched[start:end], len(matched), nil
}
