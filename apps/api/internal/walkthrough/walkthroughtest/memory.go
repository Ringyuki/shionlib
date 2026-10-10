package walkthroughtest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type MemoryRepository struct {
	mu           sync.Mutex
	now          func() time.Time
	nextID       int
	walkthroughs map[int]walkthrough.Walkthrough
	users        map[int]user.Summary
	games        map[int]bool
	rated        map[int]bool
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:          now,
		walkthroughs: map[int]walkthrough.Walkthrough{},
		users:        map[int]user.Summary{},
		games:        map[int]bool{},
		rated:        map[int]bool{},
	}
}

func (r *MemoryRepository) AddUser(summary user.Summary) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.users[summary.ID] = summary
}

func (r *MemoryRepository) AddGame(id int, rated bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.games[id] = true
	r.rated[id] = rated
}

func (r *MemoryRepository) Seed(w walkthrough.Walkthrough) walkthrough.Walkthrough {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	w.ID = r.nextID
	w.Created, w.Updated = r.now(), r.now()
	r.games[w.GameID] = true
	r.walkthroughs[w.ID] = w
	return w
}

func (r *MemoryRepository) SetUpdated(id int, at time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	w := r.walkthroughs[id]
	w.Updated = at
	r.walkthroughs[id] = w
}

func (r *MemoryRepository) Get(_ context.Context, id int) (walkthrough.Walkthrough, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	w, ok := r.walkthroughs[id]
	if !ok {
		return walkthrough.Walkthrough{}, walkthrough.ErrNotFound
	}
	return w, nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (walkthrough.Walkthrough, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) View(ctx context.Context, id int) (walkthrough.View, error) {
	w, err := r.Get(ctx, id)
	if err != nil {
		return walkthrough.View{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return walkthrough.View{Walkthrough: w, Creator: r.summary(w.CreatorID)}, nil
}

func (r *MemoryRepository) LockWritten(_ context.Context, gameID, creatorID int) (walkthrough.Walkthrough, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	w, ok := r.written(gameID, creatorID)
	if !ok {
		return walkthrough.Walkthrough{}, walkthrough.ErrNotFound
	}
	return w, nil
}

func (r *MemoryRepository) Written(_ context.Context, gameID, creatorID int) (walkthrough.Summary, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	w, ok := r.written(gameID, creatorID)
	if !ok {
		return walkthrough.Summary{}, walkthrough.ErrNotFound
	}
	return r.summarize(w), nil
}

func (r *MemoryRepository) written(gameID, creatorID int) (walkthrough.Walkthrough, bool) {
	for _, w := range r.walkthroughs {
		if w.GameID == gameID && w.CreatorID == creatorID && w.Status != walkthrough.StatusDeleted {
			return w, true
		}
	}
	return walkthrough.Walkthrough{}, false
}

func (r *MemoryRepository) Create(_ context.Context, in walkthrough.NewWalkthrough) (walkthrough.Walkthrough, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.games[in.GameID] {
		return walkthrough.Walkthrough{}, game.ErrNotFound
	}
	if _, taken := r.written(in.GameID, in.CreatorID); taken && in.Status != walkthrough.StatusDeleted {
		return walkthrough.Walkthrough{}, walkthrough.ErrAlreadyWritten
	}
	r.nextID++
	w := walkthrough.Walkthrough{
		ID:            r.nextID,
		GameID:        in.GameID,
		Note:          slices.Clone(in.Note),
		Routes:        cloneRoutes(in.Routes),
		Text:          in.Text,
		Lang:          in.Lang,
		Created:       r.now(),
		Updated:       r.now(),
		Status:        in.Status,
		CreatorID:     in.CreatorID,
		ReviewPending: in.ReviewPending,
	}
	r.walkthroughs[w.ID] = w
	return w, nil
}

func (r *MemoryRepository) Update(_ context.Context, id int, changes walkthrough.Changes) error {
	return r.update(id, func(w *walkthrough.Walkthrough) {
		w.Note = slices.Clone(changes.Note)
		w.Routes = cloneRoutes(changes.Routes)
		w.Text = changes.Text
		w.Lang = changes.Lang
		w.Status = changes.Status
		w.ReviewPending = changes.ReviewPending
		w.Edited = true
	})
}

func (r *MemoryRepository) SetStatus(_ context.Context, id int, status walkthrough.Status) error {
	return r.update(id, func(w *walkthrough.Walkthrough) {
		w.Status = status
		w.ReviewPending = false
	})
}

func (r *MemoryRepository) MarkReviewPending(_ context.Context, id int) error {
	return r.update(id, func(w *walkthrough.Walkthrough) { w.ReviewPending = true })
}

func (r *MemoryRepository) update(id int, fn func(w *walkthrough.Walkthrough)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	w, ok := r.walkthroughs[id]
	if !ok {
		return walkthrough.ErrNotFound
	}
	fn(&w)
	w.Updated = r.now()
	r.walkthroughs[id] = w
	return nil
}

func (r *MemoryRepository) ListPublished(_ context.Context, gameID, limit int) ([]walkthrough.Summary, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	matched := r.newestFirst(func(w walkthrough.Walkthrough) bool {
		return w.GameID == gameID && w.Status == walkthrough.StatusPublished
	})
	summaries := make([]walkthrough.Summary, 0, min(limit, len(matched)))
	for _, w := range matched[:min(limit, len(matched))] {
		summaries = append(summaries, r.summarize(w))
	}
	return summaries, nil
}

func (r *MemoryRepository) ListByCreator(_ context.Context, filter walkthrough.CreatorFilter, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	matched := r.newestFirst(func(w walkthrough.Walkthrough) bool {
		return w.CreatorID == filter.CreatorID && slices.Contains(filter.Statuses, w.Status) && (!filter.ExcludeRated || !r.rated[w.GameID])
	})
	slices.SortStableFunc(matched, func(a, b walkthrough.Walkthrough) int {
		return cmp.Compare(public(a), public(b))
	})
	total := len(matched)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	summaries := make([]walkthrough.Summary, 0, end-start)
	for _, w := range matched[start:end] {
		summaries = append(summaries, r.summarize(w))
	}
	return summaries, total, nil
}

func (r *MemoryRepository) newestFirst(match func(walkthrough.Walkthrough) bool) []walkthrough.Walkthrough {
	var matched []walkthrough.Walkthrough
	for _, w := range r.walkthroughs {
		if match(w) {
			matched = append(matched, w)
		}
	}
	slices.SortFunc(matched, func(a, b walkthrough.Walkthrough) int {
		return -cmp.Or(a.Updated.Compare(b.Updated), cmp.Compare(a.ID, b.ID))
	})
	return matched
}

func (r *MemoryRepository) summarize(w walkthrough.Walkthrough) walkthrough.Summary {
	return walkthrough.Summary{
		ID:            w.ID,
		GameID:        w.GameID,
		RouteCount:    len(w.Routes),
		Lang:          w.Lang,
		Created:       w.Created,
		Updated:       w.Updated,
		Status:        w.Status,
		ReviewPending: w.ReviewPending,
		Creator:       r.summary(w.CreatorID),
	}
}

func (r *MemoryRepository) summary(id int) user.Summary {
	if summary, ok := r.users[id]; ok {
		return summary
	}
	return user.Summary{ID: id}
}

func public(w walkthrough.Walkthrough) int {
	if w.Status == walkthrough.StatusPublished {
		return 1
	}
	return 0
}

func cloneRoutes(routes []walkthrough.Route) []walkthrough.Route {
	cloned := make([]walkthrough.Route, len(routes))
	for i, route := range routes {
		cloned[i] = route
		cloned[i].Characters = slices.Clone(route.Characters)
		cloned[i].Requires = slices.Clone(route.Requires)
		cloned[i].Steps = slices.Clone(route.Steps)
	}
	return cloned
}
