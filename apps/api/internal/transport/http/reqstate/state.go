package reqstate

import (
	"context"
	"sync"
)

type State struct {
	mu       sync.Mutex
	bizCode  int
	err      error
	route    string
	userID   int
	hasError bool
}

type contextKey struct{}

func With(ctx context.Context) (context.Context, *State) {
	state := &State{}
	return context.WithValue(ctx, contextKey{}, state), state
}

func From(ctx context.Context) *State {
	state, _ := ctx.Value(contextKey{}).(*State)
	return state
}

func RecordError(ctx context.Context, bizCode int, err error) {
	state := From(ctx)
	if state == nil {
		return
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	state.bizCode = bizCode
	state.err = err
	state.hasError = true
}

func RecordRoute(ctx context.Context, route string) {
	state := From(ctx)
	if state == nil {
		return
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	state.route = route
}

func RecordUser(ctx context.Context, userID int) {
	state := From(ctx)
	if state == nil {
		return
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	state.userID = userID
}

func (s *State) UserID() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.userID
}

type Snapshot struct {
	BizCode  int
	Err      error
	Route    string
	HasError bool
}

func (s *State) Snapshot() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	return Snapshot{BizCode: s.bizCode, Err: s.err, Route: s.route, HasError: s.hasError}
}
