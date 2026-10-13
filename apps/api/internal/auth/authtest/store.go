package authtest

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

type expiring[T any] struct {
	value   T
	expires time.Time
}

type MemoryStore struct {
	mu         sync.Mutex
	now        func() time.Time
	codes      map[string]expiring[auth.VerificationCode]
	resets     map[string]expiring[auth.PasswordReset]
	challenges map[string]expiring[auth.PendingPasskeyChallenge]
	replays    map[int]expiring[auth.Tokens]
}

func NewMemoryStore(now func() time.Time) *MemoryStore {
	return &MemoryStore{
		now:        now,
		codes:      map[string]expiring[auth.VerificationCode]{},
		resets:     map[string]expiring[auth.PasswordReset]{},
		challenges: map[string]expiring[auth.PendingPasskeyChallenge]{},
		replays:    map[int]expiring[auth.Tokens]{},
	}
}

func (s *MemoryStore) SaveVerificationCode(_ context.Context, id string, code auth.VerificationCode, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.codes[id+":"+code.Email] = expiring[auth.VerificationCode]{value: code, expires: s.now().Add(ttl)}
	return nil
}

func (s *MemoryStore) FindVerificationCode(_ context.Context, id, email string) (auth.VerificationCode, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	code, ok := live(s.codes, id+":"+email, s.now(), false)
	return code, ok, nil
}

func (s *MemoryStore) TakeVerificationCode(_ context.Context, id, email string) (auth.VerificationCode, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	code, ok := live(s.codes, id+":"+email, s.now(), true)
	return code, ok, nil
}

func (s *MemoryStore) SavePasswordReset(_ context.Context, reset auth.PasswordReset, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.resets[reset.Token+":"+reset.Email] = expiring[auth.PasswordReset]{value: reset, expires: s.now().Add(ttl)}
	return nil
}

func (s *MemoryStore) FindPasswordReset(_ context.Context, token, email string) (auth.PasswordReset, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	reset, ok := live(s.resets, token+":"+email, s.now(), false)
	return reset, ok, nil
}

func (s *MemoryStore) TakePasswordReset(_ context.Context, token, email string) (auth.PasswordReset, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	reset, ok := live(s.resets, token+":"+email, s.now(), true)
	return reset, ok, nil
}

func (s *MemoryStore) SavePasskeyChallenge(_ context.Context, flowID string, challenge auth.PendingPasskeyChallenge, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	challenge.State = slices.Clone(challenge.State)
	s.challenges[flowID] = expiring[auth.PendingPasskeyChallenge]{value: challenge, expires: s.now().Add(ttl)}
	return nil
}

func (s *MemoryStore) TakePasskeyChallenge(_ context.Context, flowID string) (auth.PendingPasskeyChallenge, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	challenge, ok := live(s.challenges, flowID, s.now(), true)
	return challenge, ok, nil
}

func (s *MemoryStore) SaveRefreshReplay(_ context.Context, sessionID int, tokens auth.Tokens, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.replays[sessionID] = expiring[auth.Tokens]{value: tokens, expires: s.now().Add(ttl)}
	return nil
}

func (s *MemoryStore) FindRefreshReplay(_ context.Context, sessionID int) (auth.Tokens, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tokens, ok := live(s.replays, sessionID, s.now(), false)
	return tokens, ok, nil
}

func (s *MemoryStore) DropRefreshReplays() {
	s.mu.Lock()
	defer s.mu.Unlock()
	clear(s.replays)
}

func live[K comparable, T any](entries map[K]expiring[T], key K, now time.Time, take bool) (T, bool) {
	stored, ok := entries[key]
	if !ok {
		var zero T
		return zero, false
	}
	if take || !stored.expires.After(now) {
		delete(entries, key)
	}
	if !stored.expires.After(now) {
		var zero T
		return zero, false
	}
	return stored.value, true
}
