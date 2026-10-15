package walkthroughtest

import (
	"context"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type Cast struct {
	Members map[int][]walkthrough.CastMember
}

func (c Cast) Cast(_ context.Context, gameID int) ([]walkthrough.CastMember, error) {
	return slices.Clone(c.Members[gameID]), nil
}

type Formatter struct {
	mu        sync.Mutex
	Unready   bool
	Output    walkthrough.Formatted
	Err       error
	Requested []walkthrough.FormatRequest
}

func (f *Formatter) Ready(context.Context) (bool, error) {
	return !f.Unready, nil
}

func (f *Formatter) Format(_ context.Context, request walkthrough.FormatRequest) (walkthrough.Formatted, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Requested = append(f.Requested, request)
	return f.Output, f.Err
}

type FormatTasks struct {
	mu    sync.Mutex
	tasks map[string]walkthrough.FormatTask
	TTLs  map[string]time.Duration
}

func NewFormatTasks() *FormatTasks {
	return &FormatTasks{tasks: map[string]walkthrough.FormatTask{}, TTLs: map[string]time.Duration{}}
}

func (s *FormatTasks) Save(_ context.Context, task walkthrough.FormatTask, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tasks[task.ID] = task
	s.TTLs[task.ID] = ttl
	return nil
}

func (s *FormatTasks) Get(_ context.Context, id string) (walkthrough.FormatTask, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	task, ok := s.tasks[id]
	return task, ok, nil
}

type FormatQuota struct {
	mu    sync.Mutex
	Taken map[string]int
}

func NewFormatQuota() *FormatQuota {
	return &FormatQuota{Taken: map[string]int{}}
}

func (q *FormatQuota) Take(_ context.Context, userID int, day string, limit int) (bool, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	key := day + "/" + strconv.Itoa(userID)
	q.Taken[key]++
	return q.Taken[key] <= limit, nil
}
