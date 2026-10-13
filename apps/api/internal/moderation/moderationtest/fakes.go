package moderationtest

import (
	"context"
	"slices"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type Classifier struct {
	mu        sync.Mutex
	Screening moderation.Screening
	ScreenErr error
	Verdict   moderation.Verdict
	ReviewErr error
	Screened  []string
	Reviewed  []moderation.ReviewRequest
}

func (c *Classifier) Screen(_ context.Context, text string) (moderation.Screening, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Screened = append(c.Screened, text)
	return c.Screening, c.ScreenErr
}

func (c *Classifier) Review(_ context.Context, request moderation.ReviewRequest) (moderation.Verdict, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Reviewed = append(c.Reviewed, request)
	return c.Verdict, c.ReviewErr
}

type Messages struct {
	mu   sync.Mutex
	Sent []message.NewMessage
	Err  error
}

func (m *Messages) Send(_ context.Context, in message.NewMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.Err != nil {
		return m.Err
	}
	m.Sent = append(m.Sent, in)
	return nil
}

func (m *Messages) All() []message.NewMessage {
	m.mu.Lock()
	defer m.mu.Unlock()
	return slices.Clone(m.Sent)
}

type Activities struct {
	mu       sync.Mutex
	Recorded []activity.NewActivity
}

func (a *Activities) Record(_ context.Context, in activity.NewActivity) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.Recorded = append(a.Recorded, in)
	return nil
}

func (a *Activities) All() []activity.NewActivity {
	a.mu.Lock()
	defer a.mu.Unlock()
	return slices.Clone(a.Recorded)
}

type Queue struct {
	mu   sync.Mutex
	Jobs []moderation.Job
	Err  error
}

func (q *Queue) Enqueue(_ context.Context, job moderation.Job) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.Err != nil {
		return q.Err
	}
	q.Jobs = append(q.Jobs, job)
	return nil
}

func (q *Queue) All() []moderation.Job {
	q.mu.Lock()
	defer q.mu.Unlock()
	return slices.Clone(q.Jobs)
}
