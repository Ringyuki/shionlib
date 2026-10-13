package gametest

import (
	"context"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type BangumiAuthorizer struct {
	mu          sync.Mutex
	Configured  bool
	Authorized  bool
	ExpiresAt   *time.Time
	ExchangeErr error
	Exchanged   []string
}

func (b *BangumiAuthorizer) AuthorizeURL(redirectURI, state string) (string, bool) {
	if !b.Configured {
		return "", false
	}
	return "https://bgm.test/oauth/authorize?redirect_uri=" + redirectURI + "&state=" + state, true
}

func (b *BangumiAuthorizer) Exchange(_ context.Context, code, redirectURI string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.ExchangeErr != nil {
		return b.ExchangeErr
	}
	b.Exchanged = append(b.Exchanged, code+" "+redirectURI)
	b.Authorized = true
	return nil
}

func (b *BangumiAuthorizer) Authorization(context.Context) (game.BangumiAuthorization, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return game.BangumiAuthorization{Configured: b.Configured, Authorized: b.Authorized, ExpiresAt: b.ExpiresAt}, nil
}

type BangumiStates struct {
	mu     sync.Mutex
	states map[string]string
	TTL    time.Duration
}

func NewBangumiStates() *BangumiStates {
	return &BangumiStates{states: map[string]string{}}
}

func (s *BangumiStates) Save(_ context.Context, state, returnTo string, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.states[state] = returnTo
	s.TTL = ttl
	return nil
}

func (s *BangumiStates) Take(_ context.Context, state string) (string, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	returnTo, known := s.states[state]
	delete(s.states, state)
	return returnTo, known, nil
}
