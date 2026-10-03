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

func (r *MemoryRepository) Create(_ context.Context, in walkthrough.NewWalkthrough) (walkthrough.Walkthrough, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.games[in.GameID] {
		return walkthrough.Walkthrough{}, game.ErrNotFound
	}
	r.nextID++
	w := walkthrough.Walkthrough{
		ID:            r.nextID,
		GameID:        in.GameID,
		Title:         in.Title,
		Content:       slices.Clone(in.Content),
		HTML:          in.HTML,
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
		w.Title = changes.Title
		w.Content = slices.Clone(changes.Content)
		w.HTML = changes.HTML
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

func (r *MemoryRepository) ListByGame(_ context.Context, filter walkthrough.GameFilter, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	return r.list(func(w walkthrough.Walkthrough) bool {
		if w.GameID != filter.GameID || (filter.Status != nil && w.Status != *filter.Status) {
			return false
		}
		if filter.ViewerID == 0 {
			return slices.Contains(filter.Public, w.Status)
		}
		return w.Status != walkthrough.StatusDeleted && (slices.Contains(filter.Public, w.Status) || w.CreatorID == filter.ViewerID)
	}, page)
}

func (r *MemoryRepository) ListByCreator(_ context.Context, filter walkthrough.CreatorFilter, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	return r.list(func(w walkthrough.Walkthrough) bool {
		return w.CreatorID == filter.CreatorID && slices.Contains(filter.Statuses, w.Status) && (!filter.ExcludeRated || !r.rated[w.GameID])
	}, page)
}

func (r *MemoryRepository) list(match func(walkthrough.Walkthrough) bool, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var matched []walkthrough.Walkthrough
	for _, w := range r.walkthroughs {
		if match(w) {
			matched = append(matched, w)
		}
	}
	slices.SortFunc(matched, func(a, b walkthrough.Walkthrough) int {
		return -cmp.Or(a.Created.Compare(b.Created), cmp.Compare(a.ID, b.ID))
	})
	total := len(matched)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	summaries := make([]walkthrough.Summary, 0, end-start)
	for _, w := range matched[start:end] {
		summaries = append(summaries, walkthrough.Summary{
			ID:      w.ID,
			GameID:  w.GameID,
			Title:   w.Title,
			Lang:    w.Lang,
			Created: w.Created,
			Updated: w.Updated,
			Edited:  w.Edited,
			Status:  w.Status,
			Creator: r.summary(w.CreatorID),
		})
	}
	return summaries, total, nil
}

func (r *MemoryRepository) summary(id int) user.Summary {
	if summary, ok := r.users[id]; ok {
		return summary
	}
	return user.Summary{ID: id}
}
