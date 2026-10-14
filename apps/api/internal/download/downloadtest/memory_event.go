package downloadtest

import (
	"context"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func (r *MemoryRepository) GetGameResource(_ context.Context, id int) (download.GameResource, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	resource, ok := r.resources[id]
	if !ok {
		return download.GameResource{}, download.ErrResourceNotFound
	}
	return r.gameResource(resource), nil
}

func (r *MemoryRepository) CreateEvent(_ context.Context, in download.NewEvent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.resources[in.ResourceID]; !ok {
		return download.ErrResourceNotFound
	}
	r.nextEvent++
	event := download.Event{ID: r.nextEvent, ResourceID: in.ResourceID, Kind: in.Kind, Data: in.Data, Created: r.now()}
	if in.ActorID != nil {
		actor := r.summary(*in.ActorID)
		event.Actor = &actor
	}
	r.events = append(r.events, event)
	return nil
}

func (r *MemoryRepository) ListEvents(_ context.Context, resourceID, limit int) ([]download.Event, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []download.Event
	for _, event := range slices.Backward(r.events) {
		if event.ResourceID == resourceID && len(out) < limit {
			out = append(out, event)
		}
	}
	return out, nil
}

func (r *MemoryRepository) Events(resourceID int) []download.Event {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []download.Event
	for _, event := range r.events {
		if event.ResourceID == resourceID {
			out = append(out, event)
		}
	}
	return out
}

type Discussions struct {
	Counts map[int]int
}

func (d Discussions) CountByResource(_ context.Context, resourceIDs []int) (map[int]int, error) {
	counts := map[int]int{}
	for _, id := range resourceIDs {
		if count, ok := d.Counts[id]; ok {
			counts[id] = count
		}
	}
	return counts, nil
}
