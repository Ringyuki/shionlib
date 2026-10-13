package localfs

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

var errOutsideWorkspace = errors.New("path is outside the scan workspace")

type Workspace struct {
	root string
}

func NewWorkspace(root string) *Workspace {
	return &Workspace{root: filepath.Clean(root)}
}

func (w *Workspace) Create(context.Context) (string, error) {
	if err := os.MkdirAll(w.root, dirMode); err != nil {
		return "", fmt.Errorf("create scan workspace root: %w", err)
	}
	dir, err := os.MkdirTemp(w.root, "scan-")
	if err != nil {
		return "", fmt.Errorf("create scan workspace: %w", err)
	}
	return dir, nil
}

func (w *Workspace) Link(_ context.Context, source, target string) error {
	if !w.contains(target) {
		return fmt.Errorf("link %s: %w", target, errOutsideWorkspace)
	}
	if err := os.MkdirAll(filepath.Dir(target), dirMode); err != nil {
		return fmt.Errorf("create link directory: %w", err)
	}
	if err := os.Link(filepath.Clean(source), filepath.Clean(target)); err != nil {
		return fmt.Errorf("link %s into the scan workspace: %w", filepath.Base(target), err)
	}
	return nil
}

func (w *Workspace) Files(ctx context.Context, dir string) ([]string, error) {
	if !w.contains(dir) {
		return nil, fmt.Errorf("list %s: %w", dir, errOutsideWorkspace)
	}
	var paths []string
	err := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
		if errors.Is(err, fs.ErrNotExist) && path == dir {
			return filepath.SkipAll
		}
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if entry.Type().IsRegular() {
			paths = append(paths, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("list scan workspace: %w", err)
	}
	slices.Sort(paths)
	return paths, nil
}

func (w *Workspace) Open(_ context.Context, path string) (io.ReadCloser, error) {
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return nil, fmt.Errorf("open file to scan: %w", err)
	}
	return file, nil
}

func (w *Workspace) Discard(_ context.Context, dir string) error {
	if !w.contains(dir) {
		return fmt.Errorf("discard %s: %w", dir, errOutsideWorkspace)
	}
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("discard scan workspace: %w", err)
	}
	return nil
}

func (w *Workspace) contains(path string) bool {
	cleaned := filepath.Clean(path)
	return cleaned != w.root && strings.HasPrefix(cleaned, w.root+string(filepath.Separator))
}
