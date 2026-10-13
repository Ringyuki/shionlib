package commenttest

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"math"
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
	public   map[int]bool
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:      now,
		comments: map[int]comment.Comment{},
		likes:    map[like]bool{},
		users:    map[int]user.Summary{},
		games:    map[int]bool{},
		rated:    map[int]bool{},
		public:   map[int]bool{},
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

func (r *MemoryRepository) AddResource(id int, public bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.public[id] = public
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
	c := comment.Comment{
		ID:         r.nextID,
		Content:    slices.Clone(in.Content),
		Text:       in.Text,
		GameID:     in.GameID,
		ResourceID: in.ResourceID,
		ParentID:   in.ParentID,
		RootID:     in.RootID,
		CreatorID:  in.CreatorID,
		Status:     comment.StatusPending,
		Created:    r.now(),
		Updated:    r.now(),
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

func (r *MemoryRepository) UpdateContent(_ context.Context, id int, content json.RawMessage, text string) error {
	return r.update(id, func(c *comment.Comment) {
		c.Content = slices.Clone(content)
		c.Text = text
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

func (r *MemoryRepository) ListThreads(_ context.Context, subject comment.Subject, viewerID int, order comment.Order, page comment.Page) ([]comment.Thread, comment.ThreadTotals, error) {
	visible := func(c comment.Comment) bool {
		if !subject.Holds(c) {
			return false
		}
		return c.Status == comment.StatusVisible || (c.CreatorID == viewerID && c.Status != comment.StatusBlocked)
	}
	everything := comment.Page{Number: 1, Size: math.MaxInt32}
	all, comments, _ := r.list(visible, false, viewerID, everything)
	sorted, threads, _ := r.list(func(c comment.Comment) bool { return visible(c) && (c.RootID == nil || *c.RootID == c.ID) }, order != comment.OrderOldest, viewerID, everything)
	slices.SortStableFunc(sorted, func(a, b comment.Entry) int {
		return cmp.Compare(rank(a.Comment), rank(b.Comment))
	})
	start := min(page.Offset(), len(sorted))
	roots := sorted[start:min(start+page.Size, len(sorted))]
	out := make([]comment.Thread, len(roots))
	for i, root := range roots {
		out[i] = comment.Thread{Entry: root}
		for _, entry := range all {
			if entry.RootID != nil && *entry.RootID == root.ID && entry.ID != root.ID {
				out[i].Replies = append(out[i].Replies, entry)
			}
		}
	}
	totals := comment.ThreadTotals{Threads: threads, Comments: comments}
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, c := range r.comments {
		if subject.ResourceID != 0 && c.ResourceID != nil && *c.ResourceID == subject.ResourceID && c.Pinned() {
			totals.PinnedID = id
		}
	}
	return out, totals, nil
}

func rank(c comment.Comment) int {
	if c.Pinned() {
		return 0
	}
	return 1
}

func (r *MemoryRepository) ClearPin(_ context.Context, resourceID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, c := range r.comments {
		if c.ResourceID != nil && *c.ResourceID == resourceID && c.Pinned() {
			c.PinnedAt = nil
			r.comments[id] = c
		}
	}
	return nil
}

func (r *MemoryRepository) SetPin(_ context.Context, id int, at time.Time) error {
	return r.update(id, func(c *comment.Comment) { c.PinnedAt = &at })
}

func (r *MemoryRepository) ThreadIndex(ctx context.Context, subject comment.Subject, viewerID, commentID int, order comment.Order) (int, bool, error) {
	everything := comment.Page{Number: 1, Size: math.MaxInt32}
	threads, _, err := r.ListThreads(ctx, subject, viewerID, order, everything)
	if err != nil {
		return 0, false, err
	}
	for index, thread := range threads {
		if thread.ID == commentID {
			return index, true, nil
		}
		for _, reply := range thread.Replies {
			if reply.ID == commentID {
				return index, true, nil
			}
		}
	}
	return 0, false, nil
}

func (r *MemoryRepository) ListByCreator(_ context.Context, filter comment.CreatorFilter, page comment.Page) ([]comment.Entry, int, error) {
	return r.list(func(c comment.Comment) bool {
		listed := c.ResourceID == nil || r.public[*c.ResourceID]
		return c.CreatorID == filter.CreatorID && c.Status == comment.StatusVisible && listed && (!filter.ExcludeRated || !r.rated[c.GameID])
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
			entry.Parent = &comment.ParentRef{ID: parent.ID, Text: parent.Text, Content: parent.Content, Creator: r.summary(parent.CreatorID)}
		}
	}
	if c.ResourceID != nil {
		entry.Resource = &comment.ResourceRef{ID: *c.ResourceID, GameID: c.GameID}
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
