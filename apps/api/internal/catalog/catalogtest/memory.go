package catalogtest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type LinkState struct {
	LocalID   int
	SyncedAt  *time.Time
	MissingAt *time.Time
	Excluded  *time.Time
	Failures  int
	LastError string
	order     int
}

type Store struct {
	mu         sync.Mutex
	seq        int
	links      map[catalog.Ref]*LinkState
	cursors    map[string]string
	Games      map[int]catalog.GameRecord
	Developers map[int]catalog.DeveloperRecord
	Characters map[int]catalog.CharacterRecord
	Hidden     map[int]bool
	ApplyErr   error
}

func NewStore() *Store {
	return &Store{
		links:      map[catalog.Ref]*LinkState{},
		cursors:    map[string]string{},
		Games:      map[int]catalog.GameRecord{},
		Developers: map[int]catalog.DeveloperRecord{},
		Characters: map[int]catalog.CharacterRecord{},
		Hidden:     map[int]bool{},
	}
}

func (s *Store) Link(ref catalog.Ref) (LinkState, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.links[ref]
	if !ok {
		return LinkState{}, false
	}
	return *state, true
}

func (s *Store) Seed(ref catalog.Ref, syncedAt *time.Time) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	state := s.claim(ref)
	state.SyncedAt = syncedAt
	return state.LocalID
}

func (s *Store) claim(ref catalog.Ref) *LinkState {
	if state, ok := s.links[ref]; ok {
		return state
	}
	s.seq++
	state := &LinkState{LocalID: s.seq, order: s.seq}
	s.links[ref] = state
	return state
}

func (s *Store) synced(state *LinkState, at time.Time) {
	state.SyncedAt = &at
	state.MissingAt = nil
	state.Failures = 0
	state.LastError = ""
}

func (s *Store) ApplyGame(_ context.Context, source string, record catalog.GameRecord, _ int, at time.Time) (int, []catalog.Ref, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ApplyErr != nil {
		return 0, nil, s.ApplyErr
	}
	state := s.claim(catalog.Ref{Source: source, Entity: catalog.EntityGame, ExternalID: record.ExternalID})
	s.Games[state.LocalID] = record
	var related []catalog.Ref
	seen := map[catalog.Ref]bool{}
	for _, credit := range record.Developers {
		ref := catalog.Ref{Source: source, Entity: catalog.EntityDeveloper, ExternalID: credit.ExternalID}
		linked := s.claim(ref)
		if _, ok := s.Developers[linked.LocalID]; !ok {
			s.Developers[linked.LocalID] = catalog.DeveloperRecord{ExternalID: credit.ExternalID, Name: credit.Name}
		}
		if linked.SyncedAt == nil && !seen[ref] {
			seen[ref] = true
			related = append(related, ref)
		}
	}
	for _, credit := range record.Characters {
		ref := catalog.Ref{Source: source, Entity: catalog.EntityCharacter, ExternalID: credit.ExternalID}
		linked := s.claim(ref)
		if _, ok := s.Characters[linked.LocalID]; !ok {
			s.Characters[linked.LocalID] = catalog.CharacterRecord{ExternalID: credit.ExternalID, NameJP: credit.NameJP}
		}
		if linked.SyncedAt == nil && !seen[ref] {
			seen[ref] = true
			related = append(related, ref)
		}
	}
	s.synced(state, at)
	return state.LocalID, related, nil
}

func (s *Store) ApplyDeveloper(_ context.Context, source string, record catalog.DeveloperRecord, at time.Time) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ApplyErr != nil {
		return 0, s.ApplyErr
	}
	state := s.claim(catalog.Ref{Source: source, Entity: catalog.EntityDeveloper, ExternalID: record.ExternalID})
	s.Developers[state.LocalID] = record
	s.synced(state, at)
	return state.LocalID, nil
}

func (s *Store) ApplyCharacter(_ context.Context, source string, record catalog.CharacterRecord, at time.Time) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ApplyErr != nil {
		return 0, s.ApplyErr
	}
	state := s.claim(catalog.Ref{Source: source, Entity: catalog.EntityCharacter, ExternalID: record.ExternalID})
	s.Characters[state.LocalID] = record
	s.synced(state, at)
	return state.LocalID, nil
}

func (s *Store) MarkMissing(_ context.Context, ref catalog.Ref, hide bool, at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.links[ref]
	if !ok {
		return nil
	}
	state.MissingAt = &at
	if hide && ref.Entity == catalog.EntityGame {
		s.Hidden[state.LocalID] = true
	}
	return nil
}

func (s *Store) Exclude(_ context.Context, entity catalog.Entity, localID int, at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ref, state := range s.links {
		if ref.Entity == entity && state.LocalID == localID {
			state.Excluded = &at
		}
	}
	return nil
}

func (s *Store) Include(_ context.Context, ref catalog.Ref) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if state, ok := s.links[ref]; ok {
		state.Excluded = nil
	}
	return nil
}

func (s *Store) Excluded(_ context.Context, ref catalog.Ref) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.links[ref]
	return ok && state.Excluded != nil, nil
}

func (s *Store) RecordFailure(_ context.Context, ref catalog.Ref, reason string, _ time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if state, ok := s.links[ref]; ok {
		state.Failures++
		state.LastError = reason
	}
	return nil
}

func (s *Store) Stale(_ context.Context, source string, before time.Time, limit int) ([]catalog.Ref, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	type candidate struct {
		ref   catalog.Ref
		state *LinkState
	}
	var candidates []candidate
	for ref, state := range s.links {
		if ref.Source != source || state.MissingAt != nil || state.Excluded != nil {
			continue
		}
		if state.SyncedAt == nil || state.SyncedAt.Before(before) {
			candidates = append(candidates, candidate{ref: ref, state: state})
		}
	}
	slices.SortFunc(candidates, func(a, b candidate) int {
		switch {
		case a.state.SyncedAt == nil && b.state.SyncedAt != nil:
			return -1
		case a.state.SyncedAt != nil && b.state.SyncedAt == nil:
			return 1
		case a.state.SyncedAt != nil && !a.state.SyncedAt.Equal(*b.state.SyncedAt):
			return a.state.SyncedAt.Compare(*b.state.SyncedAt)
		}
		return cmp.Compare(a.state.order, b.state.order)
	})
	if len(candidates) > limit {
		candidates = candidates[:limit]
	}
	refs := make([]catalog.Ref, len(candidates))
	for i, c := range candidates {
		refs[i] = c.ref
	}
	return refs, nil
}

func (s *Store) LocalID(_ context.Context, ref catalog.Ref) (int, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.links[ref]
	if !ok {
		return 0, false, nil
	}
	return state.LocalID, true, nil
}

func (s *Store) Cursor(_ context.Context, source string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cursors[source], nil
}

func (s *Store) SaveCursor(_ context.Context, source, cursor string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cursors[source] = cursor
	return nil
}

type Source struct {
	SourceName string
	Games      map[string]catalog.GameSnapshot
	Developers map[string]catalog.DeveloperSnapshot
	Characters map[string]catalog.CharacterSnapshot
	Hits       []catalog.SearchHit
	Feed       map[string]catalog.ChangeBatch
	Err        error
	mu         sync.Mutex
	Requests   []string
}

func NewSource(name string) *Source {
	return &Source{
		SourceName: name,
		Games:      map[string]catalog.GameSnapshot{},
		Developers: map[string]catalog.DeveloperSnapshot{},
		Characters: map[string]catalog.CharacterSnapshot{},
		Feed:       map[string]catalog.ChangeBatch{},
	}
}

func (s *Source) Name() string {
	return s.SourceName
}

func (s *Source) record(request string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Requests = append(s.Requests, request)
}

func (s *Source) Game(_ context.Context, externalID string) (catalog.GameSnapshot, error) {
	s.record("game:" + externalID)
	if s.Err != nil {
		return catalog.GameSnapshot{}, s.Err
	}
	snapshot, ok := s.Games[externalID]
	if !ok {
		return catalog.GameSnapshot{}, catalog.ErrNotFound
	}
	return snapshot, nil
}

func (s *Source) Developer(_ context.Context, externalID string) (catalog.DeveloperSnapshot, error) {
	s.record("developer:" + externalID)
	if s.Err != nil {
		return catalog.DeveloperSnapshot{}, s.Err
	}
	snapshot, ok := s.Developers[externalID]
	if !ok {
		return catalog.DeveloperSnapshot{}, catalog.ErrNotFound
	}
	return snapshot, nil
}

func (s *Source) Character(_ context.Context, externalID string) (catalog.CharacterSnapshot, error) {
	s.record("character:" + externalID)
	if s.Err != nil {
		return catalog.CharacterSnapshot{}, s.Err
	}
	snapshot, ok := s.Characters[externalID]
	if !ok {
		return catalog.CharacterSnapshot{}, catalog.ErrNotFound
	}
	return snapshot, nil
}

func (s *Source) SearchGames(_ context.Context, query string, page, size int) ([]catalog.SearchHit, int, error) {
	s.record("search:" + query)
	if s.Err != nil {
		return nil, 0, s.Err
	}
	start := min((page-1)*size, len(s.Hits))
	end := min(start+size, len(s.Hits))
	return s.Hits[start:end], len(s.Hits), nil
}

func (s *Source) Changes(_ context.Context, cursor string, _ int) (catalog.ChangeBatch, error) {
	s.record("changes:" + cursor)
	if s.Err != nil {
		return catalog.ChangeBatch{}, s.Err
	}
	batch, ok := s.Feed[cursor]
	if !ok {
		return catalog.ChangeBatch{Cursor: cursor}, nil
	}
	return batch, nil
}

type Queue struct {
	mu   sync.Mutex
	Jobs []catalog.ImportJob
	Err  error
}

func (q *Queue) Enqueue(_ context.Context, job interface{ Kind() string }) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.Err != nil {
		return q.Err
	}
	if imported, ok := job.(catalog.ImportJob); ok {
		q.Jobs = append(q.Jobs, imported)
	}
	return nil
}

func (q *Queue) Refs() []catalog.Ref {
	q.mu.Lock()
	defer q.mu.Unlock()
	refs := make([]catalog.Ref, len(q.Jobs))
	for i, job := range q.Jobs {
		refs[i] = catalog.Ref(job)
	}
	return refs
}
