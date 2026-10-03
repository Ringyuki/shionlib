package moderationtest

import (
	"context"
	"slices"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

const (
	CommentVisible = "visible"
	CommentPending = "pending"
	CommentBlocked = "blocked"

	WalkthroughDraft     = "DRAFT"
	WalkthroughPublished = "PUBLISHED"
	WalkthroughHidden    = "HIDDEN"
	WalkthroughDeleted   = "DELETED"
)

type commentRow struct {
	subject moderation.CommentSubject
	status  string
}

type walkthroughRow struct {
	subject moderation.WalkthroughSubject
	status  string
}

type MemoryRepository struct {
	mu           sync.Mutex
	comments     map[int]*commentRow
	walkthroughs map[int]*walkthroughRow
	events       []moderation.NewEvent
	nextID       int
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{comments: map[int]*commentRow{}, walkthroughs: map[int]*walkthroughRow{}}
}

func (r *MemoryRepository) SeedComment(subject moderation.CommentSubject, status string) moderation.CommentSubject {
	r.mu.Lock()
	defer r.mu.Unlock()
	if subject.ID == 0 {
		r.nextID++
		subject.ID = r.nextID
	}
	r.comments[subject.ID] = &commentRow{subject: subject, status: status}
	return subject
}

func (r *MemoryRepository) SetCommentHTML(id int, html string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.comments[id].subject.HTML = html
}

func (r *MemoryRepository) CommentStatus(id int) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if row, ok := r.comments[id]; ok {
		return row.status
	}
	return ""
}

func (r *MemoryRepository) SeedWalkthrough(subject moderation.WalkthroughSubject, status string) moderation.WalkthroughSubject {
	r.mu.Lock()
	defer r.mu.Unlock()
	if subject.ID == 0 {
		r.nextID++
		subject.ID = r.nextID
	}
	r.walkthroughs[subject.ID] = &walkthroughRow{subject: subject, status: status}
	return subject
}

func (r *MemoryRepository) SetWalkthroughStatus(id int, status string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.walkthroughs[id].status = status
}

func (r *MemoryRepository) WalkthroughStatus(id int) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if row, ok := r.walkthroughs[id]; ok {
		return row.status
	}
	return ""
}

func (r *MemoryRepository) Events() []moderation.NewEvent {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.events)
}

func (r *MemoryRepository) CommentSubject(_ context.Context, id int) (moderation.CommentSubject, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.comments[id]
	if !ok {
		return moderation.CommentSubject{}, moderation.ErrSubjectNotFound
	}
	subject := row.subject
	subject.Pending = row.status == CommentPending
	return subject, nil
}

func (r *MemoryRepository) LockCommentSubject(ctx context.Context, id int) (moderation.CommentSubject, error) {
	return r.CommentSubject(ctx, id)
}

func (r *MemoryRepository) ApproveComment(_ context.Context, id int) error {
	return r.setCommentStatus(id, CommentVisible)
}

func (r *MemoryRepository) BlockComment(_ context.Context, id int) error {
	return r.setCommentStatus(id, CommentBlocked)
}

func (r *MemoryRepository) setCommentStatus(id int, status string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.comments[id]
	if !ok {
		return moderation.ErrSubjectNotFound
	}
	row.status = status
	return nil
}

func (r *MemoryRepository) WalkthroughSubject(_ context.Context, id int) (moderation.WalkthroughSubject, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.walkthroughs[id]
	if !ok {
		return moderation.WalkthroughSubject{}, moderation.ErrSubjectNotFound
	}
	subject := row.subject
	subject.Deleted = row.status == WalkthroughDeleted
	return subject, nil
}

func (r *MemoryRepository) LockWalkthroughSubject(ctx context.Context, id int) (moderation.WalkthroughSubject, error) {
	return r.WalkthroughSubject(ctx, id)
}

func (r *MemoryRepository) PublishWalkthrough(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if row, ok := r.walkthroughs[id]; ok && (row.status == WalkthroughPublished || row.status == WalkthroughHidden) {
		row.status = WalkthroughPublished
	}
	return nil
}

func (r *MemoryRepository) HideWalkthrough(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if row, ok := r.walkthroughs[id]; ok && row.status != WalkthroughDeleted {
		row.status = WalkthroughHidden
	}
	return nil
}

func (r *MemoryRepository) RecordEvent(_ context.Context, in moderation.NewEvent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if in.CommentID != nil {
		if _, ok := r.comments[*in.CommentID]; !ok {
			return moderation.ErrSubjectNotFound
		}
	}
	if in.WalkthroughID != nil {
		if _, ok := r.walkthroughs[*in.WalkthroughID]; !ok {
			return moderation.ErrSubjectNotFound
		}
	}
	r.events = append(r.events, in)
	return nil
}
