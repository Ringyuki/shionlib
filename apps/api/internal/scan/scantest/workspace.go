package scantest

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"sync"
)

type Workspace struct {
	mu        sync.Mutex
	next      int
	Links     map[string]string
	files     map[string][]string
	Discarded []string
}

func NewWorkspace() *Workspace {
	return &Workspace{Links: map[string]string{}, files: map[string][]string{}}
}

func (w *Workspace) Put(dir string, names ...string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, name := range names {
		w.files[dir] = append(w.files[dir], filepath.Join(dir, name))
	}
}

func (w *Workspace) Create(context.Context) (string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.next++
	return fmt.Sprintf("/work/scan-%d", w.next), nil
}

func (w *Workspace) Link(_ context.Context, source, target string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Links[target] = source
	return nil
}

func (w *Workspace) Files(_ context.Context, dir string) ([]string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.files[dir], nil
}

func (w *Workspace) Open(_ context.Context, path string) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader(path)), nil
}

func (w *Workspace) Discard(_ context.Context, dir string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Discarded = append(w.Discarded, dir)
	return nil
}
