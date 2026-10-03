package messagetest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type MemoryRepository struct {
	mu       sync.Mutex
	now      func() time.Time
	nextID   int
	messages map[int]message.Stored
	users    map[int]user.Summary
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{now: now, messages: map[int]message.Stored{}, users: map[int]user.Summary{}}
}

func (r *MemoryRepository) AddUser(summary user.Summary) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.users[summary.ID] = summary
}

func (r *MemoryRepository) Create(_ context.Context, in message.NewMessage) (message.Message, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	msg := message.Message{
		ID:           r.nextID,
		Type:         in.Type,
		Tone:         in.Tone,
		Title:        in.Title,
		Content:      in.Content,
		LinkText:     in.LinkText,
		LinkURL:      in.LinkURL,
		ExternalLink: in.ExternalLink,
		Meta:         in.Meta,
		CommentID:    in.CommentID,
		GameID:       in.GameID,
		Receiver:     r.summary(in.ReceiverID),
		Created:      r.now(),
		Updated:      r.now(),
	}
	if in.SenderID != nil {
		sender := r.summary(*in.SenderID)
		msg.Sender = &sender
	}
	r.messages[msg.ID] = message.Stored{Message: msg}
	return msg, nil
}

func (r *MemoryRepository) summary(id int) user.Summary {
	if summary, ok := r.users[id]; ok {
		return summary
	}
	return user.Summary{ID: id}
}

func (r *MemoryRepository) Get(_ context.Context, id int) (message.Stored, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.messages[id]
	if !ok {
		return message.Stored{}, message.ErrNotFound
	}
	return stored, nil
}

func (r *MemoryRepository) List(_ context.Context, receiverID int, filter message.Filter, page message.Page) ([]message.Message, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var matched []message.Message
	for _, stored := range r.messages {
		msg := stored.Message
		if msg.Receiver.ID != receiverID {
			continue
		}
		if filter.Unread != nil && msg.Read == *filter.Unread {
			continue
		}
		if filter.Type != nil && msg.Type != *filter.Type {
			continue
		}
		matched = append(matched, msg)
	}
	slices.SortFunc(matched, func(a, b message.Message) int {
		if c := b.Created.Compare(a.Created); c != 0 {
			return c
		}
		return cmp.Compare(b.ID, a.ID)
	})
	total := len(matched)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	return matched[start:end], total, nil
}

func (r *MemoryRepository) CountUnread(_ context.Context, receiverID int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for _, stored := range r.messages {
		if stored.Receiver.ID == receiverID && !stored.Read {
			count++
		}
	}
	return count, nil
}

func (r *MemoryRepository) MarkRead(_ context.Context, id, receiverID int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.messages[id]
	if !ok || stored.Receiver.ID != receiverID {
		return message.ErrNotFound
	}
	stored.Read = true
	stored.ReadAt = &at
	r.messages[id] = stored
	return nil
}

func (r *MemoryRepository) MarkAllRead(_ context.Context, receiverID int, at time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, stored := range r.messages {
		if stored.Receiver.ID == receiverID && !stored.Read {
			stored.Read = true
			stored.ReadAt = &at
			r.messages[id] = stored
		}
	}
	return nil
}

func (r *MemoryRepository) MarkAllUnread(_ context.Context, receiverID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, stored := range r.messages {
		if stored.Receiver.ID == receiverID && stored.Read {
			stored.Read = false
			stored.ReadAt = nil
			r.messages[id] = stored
		}
	}
	return nil
}
