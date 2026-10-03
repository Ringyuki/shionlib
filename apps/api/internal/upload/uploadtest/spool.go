package uploadtest

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"
	"sync"
	"time"
)

const SpoolRoot = "/spool/"

type MemorySpool struct {
	mu       sync.Mutex
	files    map[string][]byte
	modified map[string]time.Time
	removed  []string
	FailNext error
}

func NewMemorySpool() *MemorySpool {
	return &MemorySpool{files: map[string][]byte{}, modified: map[string]time.Time{}}
}

func Digest(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

func (s *MemorySpool) Path(name string) string {
	return SpoolRoot + name + ".part"
}

func (s *MemorySpool) Owns(path string) bool {
	return strings.HasPrefix(path, SpoolRoot) && len(path) > len(SpoolRoot)
}

func (s *MemorySpool) Put(path string, content []byte, modified time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.files[path] = slices.Clone(content)
	s.modified[path] = modified
}

func (s *MemorySpool) Content(path string) ([]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	content, ok := s.files[path]
	return slices.Clone(content), ok
}

func (s *MemorySpool) Removed() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.removed)
}

func (s *MemorySpool) Allocate(_ context.Context, path string, size int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.FailNext; err != nil {
		s.FailNext = nil
		return err
	}
	s.files[path] = make([]byte, size)
	return nil
}

func (s *MemorySpool) Write(_ context.Context, path string, offset int64, body io.Reader, length int64) (string, error) {
	buf := make([]byte, length)
	if _, err := io.ReadFull(body, buf); err != nil {
		return "", fmt.Errorf("read chunk: %w", err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	file, ok := s.files[path]
	if !ok || offset+length > int64(len(file)) {
		return "", errors.New("write outside of the allocated file")
	}
	copy(file[offset:], buf)
	return Digest(buf), nil
}

func (s *MemorySpool) DigestRange(_ context.Context, path string, offset, length int64) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	file, ok := s.files[path]
	if !ok || offset+length > int64(len(file)) {
		return "", errors.New("range outside of the file")
	}
	return Digest(file[offset : offset+length]), nil
}

func (s *MemorySpool) Digest(_ context.Context, path string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	file, ok := s.files[path]
	if !ok {
		return "", errors.New("file not found")
	}
	return Digest(file), nil
}

func (s *MemorySpool) Remove(_ context.Context, path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.files, path)
	s.removed = append(s.removed, path)
	return nil
}

func (s *MemorySpool) Exists(_ context.Context, path string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.files[path]
	return ok, nil
}

func (s *MemorySpool) Stale(_ context.Context, before time.Time) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for path, modified := range s.modified {
		if _, ok := s.files[path]; ok && modified.Before(before) {
			out = append(out, path)
		}
	}
	slices.Sort(out)
	return out, nil
}
