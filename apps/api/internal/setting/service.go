package setting

import (
	"bytes"
	"context"
	"encoding/json"
	"sync/atomic"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

type Deps struct {
	Repo      Repository
	Tx        Transactor
	Announcer Announcer
}

type Service struct {
	repo      Repository
	tx        Transactor
	announcer Announcer
	values    atomic.Pointer[map[string]any]
}

func NewService(deps Deps) *Service {
	s := &Service{repo: deps.Repo, tx: deps.Tx, announcer: deps.Announcer}
	s.values.Store(&map[string]any{})
	return s
}

func (s *Service) Lookup(name string) (any, bool) {
	value, ok := (*s.values.Load())[name]
	return value, ok
}

func (s *Service) Reload(ctx context.Context) error {
	stored, err := s.repo.Values(ctx)
	if err != nil {
		return err
	}
	values := make(map[string]any, len(stored))
	for _, row := range stored {
		def, ok := Find(row.Name)
		if !ok {
			continue
		}
		if value, err := def.Parse(row.Value); err == nil {
			values[row.Name] = value
		}
	}
	s.values.Store(&values)
	return nil
}

func (s *Service) List(ctx context.Context) ([]Entry, error) {
	stored, err := s.repo.Values(ctx)
	if err != nil {
		return nil, err
	}
	changes, err := s.repo.LatestChanges(ctx)
	if err != nil {
		return nil, err
	}
	rows := make(map[string]*StoredValue, len(stored))
	for i := range stored {
		rows[stored[i].Name] = &stored[i]
	}
	latest := make(map[string]*Change, len(changes))
	for i := range changes {
		latest[changes[i].Name] = &changes[i]
	}
	defs := Definitions()
	entries := make([]Entry, 0, len(defs))
	for _, def := range defs {
		entries = append(entries, newEntry(def, rows[def.Name], latest[def.Name]))
	}
	return entries, nil
}

func (s *Service) Get(ctx context.Context, name string) (Entry, error) {
	def, ok := Find(name)
	if !ok {
		return Entry{}, ErrNotFound
	}
	row, found, err := s.repo.Value(ctx, name)
	if err != nil {
		return Entry{}, err
	}
	changes, _, err := s.repo.Changes(ctx, name, paging.Page{Number: 1, Size: 1})
	if err != nil {
		return Entry{}, err
	}
	var last *Change
	if len(changes) > 0 {
		last = &changes[0]
	}
	if !found {
		return newEntry(def, nil, last), nil
	}
	return newEntry(def, &row, last), nil
}

func (s *Service) Update(ctx context.Context, who actor.Actor, name string, raw json.RawMessage) (Entry, error) {
	def, ok := Find(name)
	if !ok {
		return Entry{}, ErrNotFound
	}
	value, err := def.Normalize(raw)
	if err != nil {
		return Entry{}, err
	}
	changed := false
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, found, err := s.repo.Value(ctx, name)
		if err != nil {
			return err
		}
		if found && bytes.Equal(current.Value, value) {
			return nil
		}
		var previous json.RawMessage
		if found {
			previous = current.Value
		}
		if err := s.repo.Save(ctx, name, value); err != nil {
			return err
		}
		changed = true
		return s.repo.Record(ctx, NewChange{Name: name, Previous: previous, Value: value, EditorID: who.UserID})
	})
	if err != nil {
		return Entry{}, err
	}
	return s.settle(ctx, name, changed)
}

func (s *Service) Reset(ctx context.Context, who actor.Actor, name string) (Entry, error) {
	if _, ok := Find(name); !ok {
		return Entry{}, ErrNotFound
	}
	changed := false
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, found, err := s.repo.Value(ctx, name)
		if err != nil || !found {
			return err
		}
		if err := s.repo.Remove(ctx, name); err != nil {
			return err
		}
		changed = true
		return s.repo.Record(ctx, NewChange{Name: name, Previous: current.Value, EditorID: who.UserID})
	})
	if err != nil {
		return Entry{}, err
	}
	return s.settle(ctx, name, changed)
}

func (s *Service) History(ctx context.Context, name string, page paging.Page) ([]Change, int, error) {
	if _, ok := Find(name); !ok {
		return nil, 0, ErrNotFound
	}
	return s.repo.Changes(ctx, name, page)
}

func (s *Service) settle(ctx context.Context, name string, changed bool) (Entry, error) {
	if changed {
		s.announcer.Announce(ctx)
		if err := s.Reload(ctx); err != nil {
			return Entry{}, err
		}
	}
	return s.Get(ctx, name)
}
