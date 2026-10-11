package inspectiontest

import (
	"context"
	"errors"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

var ErrHidden = errors.New("the resource is hidden from the viewer")

type Resources struct {
	Visible map[int][]int
	Err     error
}

func (r Resources) Inspections(_ context.Context, _ actor.Actor, resourceID int) ([]int, error) {
	if r.Err != nil {
		return nil, r.Err
	}
	return r.Visible[resourceID], nil
}

type PreviewStore struct {
	mu      sync.Mutex
	Objects map[string][]byte
	Types   map[string]string
	Err     error
}

func NewPreviewStore() *PreviewStore {
	return &PreviewStore{Objects: map[string][]byte{}, Types: map[string]string{}}
}

func (s *PreviewStore) PutBytes(_ context.Context, key string, data []byte, contentType string, _ map[string]string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Err != nil {
		return s.Err
	}
	s.Objects[key] = append([]byte{}, data...)
	s.Types[key] = contentType
	return nil
}

func (s *PreviewStore) GetBytes(_ context.Context, key string, limit int64) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, found := s.Objects[key]
	if !found {
		return nil, inspection.ErrNoPreview
	}
	return data[:min(int64(len(data)), limit)], nil
}

func (s *PreviewStore) Delete(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Err != nil {
		return s.Err
	}
	delete(s.Objects, key)
	delete(s.Types, key)
	return nil
}

func (s *PreviewStore) Keys() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	keys := make([]string, 0, len(s.Objects))
	for key := range s.Objects {
		keys = append(keys, key)
	}
	return keys
}

type ImageShrinker struct {
	Unreadable bool
}

func (s ImageShrinker) Shrink(_ context.Context, data []byte, _ int) ([]byte, error) {
	if s.Unreadable {
		return nil, inspection.ErrUnreadableImage
	}
	return append([]byte("webp:"), data...), nil
}
