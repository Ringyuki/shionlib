package apikeytest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type MemoryRepository struct {
	mu     sync.Mutex
	nextID int
	keys   map[int]apikey.Key
	hashes map[int]string
	owners map[int]apikey.Owner
	now    func() time.Time
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{keys: map[int]apikey.Key{}, hashes: map[int]string{}, owners: map[int]apikey.Owner{}, now: now}
}

func (r *MemoryRepository) AddUser(id int, owner apikey.Owner) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.owners[id] = owner
}

func (r *MemoryRepository) Create(_ context.Context, in apikey.NewKey) (apikey.Key, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	key := apikey.Key{ID: r.nextID, UserID: in.UserID, Name: in.Name, Prefix: in.Prefix, Status: apikey.StatusActive, Created: r.now()}
	r.keys[key.ID] = key
	r.hashes[key.ID] = in.SecretHash
	return key, nil
}

func (r *MemoryRepository) Mine(_ context.Context, userID int) ([]apikey.Key, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []apikey.Key{}
	for _, key := range r.keys {
		if key.UserID == userID {
			out = append(out, key)
		}
	}
	slices.SortFunc(out, func(a, b apikey.Key) int { return cmp.Or(b.Created.Compare(a.Created), cmp.Compare(b.ID, a.ID)) })
	return out, nil
}

func (r *MemoryRepository) CountMine(ctx context.Context, userID int) (int, error) {
	mine, err := r.Mine(ctx, userID)
	return len(mine), err
}

func (r *MemoryRepository) DeleteMine(_ context.Context, userID, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key, ok := r.keys[id]
	if !ok || key.UserID != userID {
		return apikey.ErrNotFound
	}
	delete(r.keys, id)
	delete(r.hashes, id)
	return nil
}

func (r *MemoryRepository) BySecretHash(_ context.Context, hash string) (apikey.Key, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, stored := range r.hashes {
		if stored == hash {
			return r.keys[id], nil
		}
	}
	return apikey.Key{}, apikey.ErrNotFound
}

func (r *MemoryRepository) Owner(_ context.Context, userID int) (apikey.Owner, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	owner, ok := r.owners[userID]
	if !ok {
		return apikey.Owner{}, apikey.ErrKeyInvalid
	}
	return owner, nil
}

func (r *MemoryRepository) Touch(_ context.Context, id int, at time.Time, ip string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key, ok := r.keys[id]
	if !ok {
		return nil
	}
	key.LastUsedAt, key.LastUsedIP = &at, &ip
	r.keys[id] = key
	return nil
}

func (r *MemoryRepository) Get(_ context.Context, id int) (apikey.Key, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key, ok := r.keys[id]
	if !ok {
		return apikey.Key{}, apikey.ErrNotFound
	}
	return key, nil
}

func (r *MemoryRepository) SetSuspended(_ context.Context, id int, reason *string, at *time.Time, _ *int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key, ok := r.keys[id]
	if !ok {
		return apikey.ErrNotFound
	}
	key.Status = apikey.StatusActive
	if at != nil {
		key.Status = apikey.StatusSuspended
	}
	key.SuspendedReason, key.SuspendedAt = reason, at
	r.keys[id] = key
	return nil
}

func (r *MemoryRepository) SetAccountLimit(_ context.Context, userID int, limit *int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	owner, ok := r.owners[userID]
	if !ok {
		return user.ErrNotFound
	}
	owner.Limit = limit
	r.owners[userID] = owner
	return nil
}

type Counter struct {
	mu     sync.Mutex
	counts map[time.Time]map[int]*apikey.Count
}

func NewCounter() *Counter {
	return &Counter{counts: map[time.Time]map[int]*apikey.Count{}}
}

func (c *Counter) Count(_ context.Context, keyID int, day time.Time, throttled bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.counts[day] == nil {
		c.counts[day] = map[int]*apikey.Count{}
	}
	count := c.counts[day][keyID]
	if count == nil {
		count = &apikey.Count{KeyID: keyID, Day: day}
		c.counts[day][keyID] = count
	}
	if throttled {
		count.Throttled++
	} else {
		count.Requests++
	}
	return nil
}

func (c *Counter) Counts(_ context.Context, day time.Time) ([]apikey.Count, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := []apikey.Count{}
	for _, count := range c.counts[day] {
		out = append(out, *count)
	}
	slices.SortFunc(out, func(a, b apikey.Count) int { return cmp.Compare(a.KeyID, b.KeyID) })
	return out, nil
}

type UsageStore struct {
	mu      sync.Mutex
	Saved   []apikey.Count
	Pruned  []time.Time
	DayRows []apikey.Day
	Listed  []apikey.Listed
	Details map[int]apikey.Detail
	Totals  apikey.Summary
}

func (u *UsageStore) SaveCounts(_ context.Context, counts []apikey.Count) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.Saved = append(u.Saved, counts...)
	return nil
}

func (u *UsageStore) PruneBefore(_ context.Context, day time.Time) error {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.Pruned = append(u.Pruned, day)
	return nil
}

func (u *UsageStore) Summary(context.Context, time.Time, time.Time) (apikey.Summary, error) {
	return u.Totals, nil
}

func (u *UsageStore) Days(context.Context, time.Time, *int) ([]apikey.Day, error) {
	return slices.Clone(u.DayRows), nil
}

func (u *UsageStore) List(context.Context, apikey.Filter, paging.Page) ([]apikey.Listed, int, error) {
	return slices.Clone(u.Listed), len(u.Listed), nil
}

func (u *UsageStore) Detail(_ context.Context, id int, _ time.Time) (apikey.Detail, error) {
	detail, ok := u.Details[id]
	if !ok {
		return apikey.Detail{}, apikey.ErrNotFound
	}
	return detail, nil
}

type Messages struct {
	mu   sync.Mutex
	Sent []message.NewMessage
}

func (m *Messages) Send(_ context.Context, in message.NewMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Sent = append(m.Sent, in)
	return nil
}

type Transactor struct{}

func (Transactor) WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}
