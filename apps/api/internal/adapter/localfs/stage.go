package localfs

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

const (
	stagedFileMode   = 0o640
	escapedByteBase  = 0xEF00
	escapedByteFirst = 0xEF80
	escapedByteLast  = 0xEFFF
)

var errOutsideStage = errors.New("path is outside the composition stage")

type Stage struct {
	root string
}

func NewStage(root string) *Stage {
	return &Stage{root: filepath.Clean(root)}
}

func (s *Stage) contains(path string) bool {
	cleaned := filepath.Clean(path)
	return strings.HasPrefix(cleaned, s.root+string(filepath.Separator))
}

func (s *Stage) Open(_ context.Context, id int) (string, error) {
	dir := filepath.Join(s.root, strconv.Itoa(id))
	if err := os.MkdirAll(dir, dirMode); err != nil {
		return "", fmt.Errorf("open composition stage %d: %w", id, err)
	}
	return dir, nil
}

func (s *Stage) Clear(ctx context.Context, dir string) error {
	if err := s.Remove(ctx, dir); err != nil {
		return err
	}
	if err := os.MkdirAll(dir, dirMode); err != nil {
		return fmt.Errorf("clear %s: %w", filepath.Base(dir), err)
	}
	return nil
}

func (s *Stage) Discard(ctx context.Context, dir string) error {
	return s.Remove(ctx, dir)
}

func (s *Stage) Remove(_ context.Context, path string) error {
	if !s.contains(path) {
		return fmt.Errorf("remove %s: %w", path, errOutsideStage)
	}
	if err := os.RemoveAll(filepath.Clean(path)); err != nil {
		return fmt.Errorf("remove %s: %w", filepath.Base(path), err)
	}
	return nil
}

func (s *Stage) Tree(ctx context.Context, dir string) ([]composition.Node, error) {
	if !s.contains(dir) {
		return nil, fmt.Errorf("list %s: %w", dir, errOutsideStage)
	}
	nodes := []composition.Node{}
	err := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if path == dir || (!entry.IsDir() && !entry.Type().IsRegular()) {
			return nil
		}
		rest, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		node := composition.Node{Path: filepath.ToSlash(rest), Dir: entry.IsDir()}
		if !node.Dir {
			info, err := entry.Info()
			if err != nil {
				return err
			}
			node.Size = info.Size()
		}
		nodes = append(nodes, node)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", filepath.Base(dir), err)
	}
	return nodes, nil
}

func (s *Stage) Sweep(ctx context.Context, dir, encoding string) error {
	if !s.contains(dir) {
		return fmt.Errorf("sweep %s: %w", dir, errOutsideStage)
	}
	if err := sweep(ctx, dir, inspection.Encoding(encoding)); err != nil {
		return fmt.Errorf("sweep %s: %w", filepath.Base(dir), err)
	}
	return nil
}

func sweep(ctx context.Context, dir string, encoding inspection.Encoding) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.Chmod(dir, dirMode); err != nil {
		return err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		path := filepath.Join(dir, entry.Name())
		switch {
		case entry.IsDir():
			if err := sweep(ctx, path, encoding); err != nil {
				return err
			}
		case entry.Type().IsRegular():
			if err := os.Chmod(path, stagedFileMode); err != nil {
				return err
			}
		default:
			if err := os.Remove(path); err != nil {
				return err
			}
			continue
		}
		if err := rename(dir, entry.Name(), encoding); err != nil {
			return err
		}
	}
	return nil
}

func rename(dir, name string, encoding inspection.Encoding) error {
	parts := named(name, encoding)
	if len(parts) == 0 || (len(parts) == 1 && parts[0] == name) {
		return nil
	}
	target := filepath.Join(append([]string{dir}, parts...)...)
	if _, err := os.Lstat(target); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(target), dirMode); err != nil {
		return err
	}
	return os.Rename(filepath.Join(dir, name), target)
}

func named(name string, encoding inspection.Encoding) []string {
	if encoding.Legacy() {
		if raw, ok := writtenBytes(name); ok {
			if decoded, ok := inspection.Decode(raw, encoding); ok {
				name = decoded
			}
		}
	}
	parts := strings.FieldsFunc(name, func(r rune) bool { return r == '\\' || r == '/' })
	return slices.DeleteFunc(parts, func(part string) bool { return part == "." || part == ".." })
}

func writtenBytes(name string) ([]byte, bool) {
	raw := make([]byte, 0, len(name))
	escaped := false
	for _, char := range name {
		if char >= escapedByteFirst && char <= escapedByteLast {
			raw = append(raw, byte(char-escapedByteBase))
			escaped = true
			continue
		}
		raw = utf8.AppendRune(raw, char)
	}
	if escaped {
		return raw, true
	}
	oem, err := charmap.CodePage437.NewEncoder().String(name)
	return []byte(oem), err == nil
}

func (s *Stage) Move(_ context.Context, source, target string) error {
	if !s.contains(source) || !s.contains(target) {
		return fmt.Errorf("move %s: %w", target, errOutsideStage)
	}
	if err := os.MkdirAll(filepath.Dir(target), dirMode); err != nil {
		return fmt.Errorf("move to %s: %w", filepath.Base(target), err)
	}
	if err := os.Rename(filepath.Clean(source), filepath.Clean(target)); err != nil {
		return fmt.Errorf("move to %s: %w", filepath.Base(target), err)
	}
	return nil
}

func (s *Stage) Link(_ context.Context, source, target string) error {
	if !s.contains(source) || !s.contains(target) {
		return fmt.Errorf("link %s: %w", target, errOutsideStage)
	}
	if err := os.MkdirAll(filepath.Dir(target), dirMode); err != nil {
		return fmt.Errorf("link %s: %w", filepath.Base(target), err)
	}
	if err := os.Link(filepath.Clean(source), filepath.Clean(target)); err != nil {
		return fmt.Errorf("link %s: %w", filepath.Base(target), err)
	}
	return nil
}

func (s *Stage) Size(ctx context.Context, path string) (int64, error) {
	if !s.contains(path) {
		return 0, fmt.Errorf("measure %s: %w", path, errOutsideStage)
	}
	var size int64
	err := filepath.WalkDir(path, func(_ string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		size += info.Size()
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("measure %s: %w", filepath.Base(path), err)
	}
	return size, nil
}

func (s *Stage) Dirs(context.Context) ([]int, error) {
	entries, err := os.ReadDir(s.root)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list composition stages: %w", err)
	}
	ids := []int{}
	for _, entry := range entries {
		if id, err := strconv.Atoi(entry.Name()); err == nil && entry.IsDir() {
			ids = append(ids, id)
		}
	}
	return ids, nil
}
