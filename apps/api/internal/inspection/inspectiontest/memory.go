package inspectiontest

import (
	"cmp"
	"context"
	"path"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type storedEntry struct {
	inspection.Entry
	position int
}

type MemoryRepository struct {
	mu          sync.Mutex
	nextID      int
	nextEntryID int
	inspections map[int]inspection.Inspection
	entries     map[int]storedEntry
	attached    map[int]bool
	Resources   map[int]bool
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		inspections: map[int]inspection.Inspection{},
		entries:     map[int]storedEntry{},
		attached:    map[int]bool{},
		Resources:   map[int]bool{},
	}
}

func (r *MemoryRepository) NewResource() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	id := len(r.Resources) + 1
	r.Resources[id] = true
	return id
}

func (r *MemoryRepository) Attach(inspectionID int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.attached[inspectionID] = true
}

func (r *MemoryRepository) Create(_ context.Context, in inspection.NewInspection) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.Resources[in.ResourceID] {
		return 0, inspection.ErrResourceGone
	}
	r.nextID++
	scan := in.Scan
	scan.Skipped = append([]string{}, in.Scan.Skipped...)
	scan.Detections = append([]inspection.Detection{}, in.Scan.Detections...)
	r.inspections[r.nextID] = inspection.Inspection{
		ID:         r.nextID,
		ResourceID: in.ResourceID,
		Status:     in.Status,
		Archive:    in.Archive,
		Totals:     in.Totals,
		Truncated:  in.Truncated,
		Verified:   in.Verified,
		Scan:       scan,
		Created:    time.Now().UTC(),
	}
	return r.nextID, nil
}

func (r *MemoryRepository) AddEntries(_ context.Context, inspectionID int, entries []inspection.NewEntry) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, found := r.inspections[inspectionID]; !found {
		return nil, inspection.ErrNotFound
	}
	ids := make([]int, len(entries))
	for i, entry := range entries {
		r.nextEntryID++
		ids[i] = r.nextEntryID
		r.entries[r.nextEntryID] = storedEntry{position: entry.Position, Entry: inspection.Entry{
			ID:           r.nextEntryID,
			InspectionID: inspectionID,
			ParentID:     entry.ParentID,
			Name:         entry.Name,
			Kind:         entry.Kind,
			Size:         entry.Size,
			Modified:     entry.Modified,
			Items:        entry.Items,
			Children:     entry.Children,
			Encrypted:    entry.Encrypted,
			Unreadable:   entry.Unreadable,
			Detail:       entry.Detail,
		}}
	}
	return ids, nil
}

func (r *MemoryRepository) SetPreview(_ context.Context, entryID int, preview inspection.Preview) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, found := r.entries[entryID]
	if !found {
		return inspection.ErrEntryNotFound
	}
	entry.Preview = preview
	r.entries[entryID] = entry
	return nil
}

func (r *MemoryRepository) Get(_ context.Context, id int) (inspection.Inspection, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, found := r.inspections[id]
	if !found {
		return inspection.Inspection{}, inspection.ErrNotFound
	}
	return item, nil
}

func (r *MemoryRepository) ByIDs(_ context.Context, ids []int) ([]inspection.Inspection, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	found := []inspection.Inspection{}
	for id, item := range r.inspections {
		if slices.Contains(ids, id) {
			found = append(found, item)
		}
	}
	slices.SortFunc(found, func(a, b inspection.Inspection) int { return cmp.Compare(a.ID, b.ID) })
	return found, nil
}

func (r *MemoryRepository) selectEntries(keep func(entry storedEntry) bool, order func(a, b storedEntry) int) []storedEntry {
	var kept []storedEntry
	for _, entry := range r.entries {
		if keep(entry) {
			kept = append(kept, entry)
		}
	}
	slices.SortFunc(kept, func(a, b storedEntry) int {
		return cmp.Or(order(a, b), cmp.Compare(a.ID, b.ID))
	})
	return kept
}

func paged[T any](items []T, page inspection.Page) []T {
	start := min(page.Offset(), len(items))
	return items[start:min(start+page.Size, len(items))]
}

func (r *MemoryRepository) Discs(_ context.Context, inspectionIDs []int) ([]inspection.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	kept := r.selectEntries(
		func(entry storedEntry) bool {
			return entry.Kind == inspection.KindDisc && slices.Contains(inspectionIDs, entry.InspectionID)
		},
		func(a, b storedEntry) int { return cmp.Compare(a.InspectionID, b.InspectionID) },
	)
	discs := make([]inspection.Entry, len(kept))
	for i, entry := range kept {
		discs[i] = entry.Entry
	}
	return discs, nil
}

func (r *MemoryRepository) MediumNames(_ context.Context, inspectionID int) ([]string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	kept := r.selectEntries(
		func(entry storedEntry) bool {
			if entry.InspectionID != inspectionID {
				return false
			}
			extension := strings.ToLower(strings.TrimPrefix(path.Ext(entry.Name), "."))
			return entry.Kind == inspection.KindDisc || (entry.Kind == inspection.KindFile && slices.Contains(inspection.SheetExtensions, extension))
		},
		func(a, b storedEntry) int { return 0 },
	)
	names := make([]string, len(kept))
	for i, entry := range kept {
		names[i] = entry.Name
	}
	return names, nil
}

func (r *MemoryRepository) FilePaths(_ context.Context, inspectionID int) ([]inspection.FilePath, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	byID := map[int]storedEntry{}
	for _, entry := range r.entries {
		byID[entry.ID] = entry
	}
	kept := r.selectEntries(
		func(entry storedEntry) bool {
			return entry.InspectionID == inspectionID && entry.Kind != inspection.KindFolder && entry.Kind != inspection.KindTrack
		},
		func(a, b storedEntry) int { return 0 },
	)
	files := []inspection.FilePath{}
	for _, entry := range kept {
		name, plain := entry.Name, true
		for parent := entry.ParentID; parent != nil; parent = byID[*parent].ParentID {
			above := byID[*parent]
			plain = plain && above.Kind == inspection.KindFolder
			name = above.Name + "/" + name
		}
		if plain {
			files = append(files, inspection.FilePath{Path: name, Size: entry.Size})
		}
	}
	return files, nil
}

func sameParent(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func (r *MemoryRepository) Children(_ context.Context, inspectionID int, parentID *int, page inspection.Page) ([]inspection.Entry, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	kept := r.selectEntries(
		func(entry storedEntry) bool {
			return entry.InspectionID == inspectionID && sameParent(entry.ParentID, parentID)
		},
		func(a, b storedEntry) int { return cmp.Compare(a.position, b.position) },
	)
	entries := []inspection.Entry{}
	for _, entry := range paged(kept, page) {
		entries = append(entries, entry.Entry)
	}
	return entries, len(kept), nil
}

func (r *MemoryRepository) location(entry inspection.Entry) string {
	var names []string
	for parent := entry.ParentID; parent != nil; parent = r.entries[*parent].ParentID {
		names = append(names, r.entries[*parent].Name)
	}
	slices.Reverse(names)
	return strings.Join(names, "/")
}

func (r *MemoryRepository) Search(_ context.Context, inspectionID int, query string, page inspection.Page) ([]inspection.Found, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	needle := strings.ToLower(query)
	kept := r.selectEntries(
		func(entry storedEntry) bool {
			return entry.InspectionID == inspectionID && entry.Kind != inspection.KindFolder && strings.Contains(strings.ToLower(entry.Name), needle)
		},
		func(a, b storedEntry) int { return cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)) },
	)
	found := []inspection.Found{}
	for _, entry := range paged(kept, page) {
		found = append(found, inspection.Found{Entry: entry.Entry, Location: r.location(entry.Entry)})
	}
	return found, len(kept), nil
}

func (r *MemoryRepository) GetEntry(_ context.Context, id int) (inspection.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, found := r.entries[id]
	if !found {
		return inspection.Entry{}, inspection.ErrEntryNotFound
	}
	return entry.Entry, nil
}

func (r *MemoryRepository) MarkCleared(_ context.Context, ids []int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, id := range ids {
		if item, found := r.inspections[id]; found {
			cleared := at.UTC()
			item.Scan.ClearedAt = &cleared
			r.inspections[id] = item
		}
	}
	return nil
}

func (r *MemoryRepository) Orphans(_ context.Context, before time.Time, limit int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ids := []int{}
	for id, item := range r.inspections {
		if !r.attached[id] && !item.Created.After(before) {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	return ids[:min(limit, len(ids))], nil
}

func (r *MemoryRepository) PreviewEntries(_ context.Context, inspectionID int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ids := []int{}
	for id, entry := range r.entries {
		if entry.InspectionID == inspectionID && entry.Preview != inspection.PreviewNone {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	return ids, nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, found := r.inspections[id]; !found {
		return inspection.ErrNotFound
	}
	delete(r.inspections, id)
	delete(r.attached, id)
	for entryID, entry := range r.entries {
		if entry.InspectionID == id {
			delete(r.entries, entryID)
		}
	}
	return nil
}
