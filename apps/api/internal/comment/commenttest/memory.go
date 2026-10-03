package commenttest

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type like struct {
	commentID int
	userID    int
}

type MemoryRepository struct {
	mu       sync.Mutex
	now      func() time.Time
	nextID   int
	comments map[int]comment.Comment
	likes    map[like]bool
	users    map[int]user.Summary
	games    map[int]bool
	rated    map[int]bool
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:      now,
		comments: map[int]comment.Comment{},
		likes:    map[like]bool{},
		users:    map[int]user.Summary{},
		games:    map[int]bool{},
		rated:    map[int]bool{},
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

func (r *MemoryRepository) Seed(c comment.Comment) comment.Comment {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	c.ID = r.nextID
	c.Created, c.Updated = r.now(), r.now()
	r.games[c.GameID] = true
	r.comments[c.ID] = c
	return c
}

func (r *MemoryRepository) Get(_ context.Context, id int) (comment.Comment, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.comments[id]
	if !ok {
		return comment.Comment{}, comment.ErrNotFound
	}
	return c, nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (comment.Comment, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) Create(_ context.Context, in comment.NewComment) (comment.Comment, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.games[in.GameID] {
		return comment.Comment{}, game.ErrNotFound
	}
	if in.ParentID != nil {
		if _, ok := r.comments[*in.ParentID]; !ok {
			return comment.Comment{}, comment.ErrNotFound
		}
	}
	r.nextID++
	html := in.HTML
	c := comment.Comment{
		ID:        r.nextID,
		Content:   slices.Clone(in.Content),
		HTML:      &html,
		GameID:    in.GameID,
		ParentID:  in.ParentID,
		RootID:    in.RootID,
		CreatorID: in.CreatorID,
		Status:    comment.StatusPending,
		Created:   r.now(),
		Updated:   r.now(),
	}
	r.comments[c.ID] = c
	return c, nil
}

func (r *MemoryRepository) update(id int, fn func(c *comment.Comment)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.comments[id]
	if !ok {
		return comment.ErrNotFound
	}
	fn(&c)
	c.Updated = r.now()
	r.comments[id] = c
	return nil
}

func (r *MemoryRepository) SetRoot(_ context.Context, id, rootID int) error {
	return r.update(id, func(c *comment.Comment) { c.RootID = &rootID })
}

func (r *MemoryRepository) AdjustReplyCount(_ context.Context, id, delta int) error {
	err := r.update(id, func(c *comment.Comment) { c.ReplyCount = max(c.ReplyCount+delta, 0) })
	if errors.Is(err, comment.ErrNotFound) {
		return nil
	}
	return err
}

func (r *MemoryRepository) UpdateContent(_ context.Context, id int, content json.RawMessage, html string) error {
	return r.update(id, func(c *comment.Comment) {
		c.Content = slices.Clone(content)
		c.HTML = &html
		c.Edited = true
		c.Status = comment.StatusPending
	})
}

func (r *MemoryRepository) SetStatus(_ context.Context, id int, status comment.Status) error {
	return r.update(id, func(c *comment.Comment) { c.Status = status })
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.comments[id]; !ok {
		return comment.ErrNotFound
	}
	delete(r.comments, id)
	for key, c := range r.comments {
		if c.ParentID != nil && *c.ParentID == id {
			c.ParentID = nil
		}
		if c.RootID != nil && *c.RootID == id {
			c.RootID = nil
		}
		r.comments[key] = c
	}
	for key := range r.likes {
		if key.commentID == id {
			delete(r.likes, key)
		}
	}
	return nil
}

func (r *MemoryRepository) Entry(_ context.Context, id, viewerID int) (comment.Entry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.comments[id]
	if !ok {
		return comment.Entry{}, comment.ErrNotFound
	}
	return r.entry(c, viewerID), nil
}

func (r *MemoryRepository) ListByGame(_ context.Context, gameID, viewerID int, page comment.Page) ([]comment.Entry, int, error) {
	return r.list(func(c comment.Comment) bool {
		if c.GameID != gameID {
			return false
		}
		return c.Status == comment.StatusVisible || (c.CreatorID == viewerID && c.Status != comment.StatusBlocked)
	}, false, viewerID, page)
}

func (r *MemoryRepository) ListByCreator(_ context.Context, filter comment.CreatorFilter, page comment.Page) ([]comment.Entry, int, error) {
	return r.list(func(c comment.Comment) bool {
		return c.CreatorID == filter.CreatorID && c.Status == comment.StatusVisible && (!filter.ExcludeRated || !r.rated[c.GameID])
	}, true, filter.ViewerID, page)
}

func (r *MemoryRepository) list(match func(comment.Comment) bool, newestFirst bool, viewerID int, page comment.Page) ([]comment.Entry, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var matched []comment.Comment
	for _, c := range r.comments {
		if match(c) {
			matched = append(matched, c)
		}
	}
	slices.SortFunc(matched, func(a, b comment.Comment) int {
		order := cmp.Or(a.Created.Compare(b.Created), cmp.Compare(a.ID, b.ID))
		if newestFirst {
			return -order
		}
		return order
	})
	total := len(matched)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	entries := make([]comment.Entry, 0, end-start)
	for _, c := range matched[start:end] {
		entries = append(entries, r.entry(c, viewerID))
	}
	return entries, total, nil
}

func (r *MemoryRepository) entry(c comment.Comment, viewerID int) comment.Entry {
	entry := comment.Entry{Comment: c, Creator: r.summary(c.CreatorID), Liked: viewerID > 0 && r.likes[like{c.ID, viewerID}]}
	for key := range r.likes {
		if key.commentID == c.ID {
			entry.LikeCount++
		}
	}
	if c.ParentID != nil {
		if parent, ok := r.comments[*c.ParentID]; ok {
			entry.Parent = &comment.ParentRef{ID: parent.ID, HTML: parent.HTML, Creator: r.summary(parent.CreatorID)}
		}
	}
	return entry
}

func (r *MemoryRepository) summary(id int) user.Summary {
	if summary, ok := r.users[id]; ok {
		return summary
	}
	return user.Summary{ID: id}
}

func (r *MemoryRepository) HasLike(_ context.Context, commentID, userID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.likes[like{commentID, userID}], nil
}

func (r *MemoryRepository) AddLike(_ context.Context, commentID, userID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.comments[commentID]; !ok {
		return false, comment.ErrNotFound
	}
	key := like{commentID, userID}
	if r.likes[key] {
		return false, nil
	}
	r.likes[key] = true
	return true, nil
}

func (r *MemoryRepository) RemoveLike(_ context.Context, commentID, userID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.likes, like{commentID, userID})
	return nil
}
