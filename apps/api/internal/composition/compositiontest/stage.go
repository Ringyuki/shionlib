package compositiontest

import (
	"cmp"
	"context"
	"fmt"
	"path"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

type Stage struct {
	mu        sync.Mutex
	files     map[string]int64
	dirs      map[string]bool
	Links     map[string]string
	Swept     []string
	Encodings []string
}

func NewStage() *Stage {
	return &Stage{files: map[string]int64{}, dirs: map[string]bool{}, Links: map[string]string{}}
}

func (s *Stage) Put(name string, size int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.files[name] = size
	s.parents(name)
}

func (s *Stage) MakeDir(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dirs[name] = true
	s.parents(name)
}

func (s *Stage) parents(name string) {
	for dir := path.Dir(name); dir != "/" && dir != "."; dir = path.Dir(dir) {
		s.dirs[dir] = true
	}
}

func (s *Stage) Has(name string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, file := s.files[name]
	return file || s.dirs[name]
}

func (s *Stage) Files(dir string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	found := []string{}
	for name := range s.files {
		if rest, ok := strings.CutPrefix(name, dir+"/"); ok {
			found = append(found, rest)
		}
	}
	slices.Sort(found)
	return found
}

func (s *Stage) Open(_ context.Context, id int) (string, error) {
	dir := path.Join(StageRoot, strconv.Itoa(id))
	s.MakeDir(dir)
	return dir, nil
}

func (s *Stage) within(name string) error {
	if !strings.HasPrefix(name, StageRoot+"/") {
		return fmt.Errorf("%s is outside the stage", name)
	}
	return nil
}

func (s *Stage) drop(name string) {
	delete(s.files, name)
	delete(s.dirs, name)
	for file := range s.files {
		if strings.HasPrefix(file, name+"/") {
			delete(s.files, file)
		}
	}
	for dir := range s.dirs {
		if strings.HasPrefix(dir, name+"/") {
			delete(s.dirs, dir)
		}
	}
}

func (s *Stage) Clear(_ context.Context, dir string) error {
	if err := s.within(dir); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.drop(dir)
	s.dirs[dir] = true
	return nil
}

func (s *Stage) Discard(ctx context.Context, dir string) error {
	return s.Remove(ctx, dir)
}

func (s *Stage) Remove(_ context.Context, name string) error {
	if err := s.within(name); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.drop(name)
	return nil
}

func (s *Stage) Tree(_ context.Context, dir string) ([]composition.Node, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	nodes := []composition.Node{}
	for name := range s.dirs {
		if rest, ok := strings.CutPrefix(name, dir+"/"); ok {
			nodes = append(nodes, composition.Node{Path: rest, Dir: true})
		}
	}
	for name, size := range s.files {
		if rest, ok := strings.CutPrefix(name, dir+"/"); ok {
			nodes = append(nodes, composition.Node{Path: rest, Size: size})
		}
	}
	slices.SortFunc(nodes, func(a, b composition.Node) int { return cmp.Compare(a.Path, b.Path) })
	return nodes, nil
}

func (s *Stage) Sweep(_ context.Context, dir, encoding string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Swept = append(s.Swept, dir)
	s.Encodings = append(s.Encodings, encoding)
	return nil
}

func (s *Stage) Move(_ context.Context, source, target string) error {
	if err := s.within(target); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if size, file := s.files[source]; file {
		if s.dirs[target] {
			return fmt.Errorf("move %s: %s is a folder", source, target)
		}
		delete(s.files, source)
		s.files[target] = size
		s.parents(target)
		return nil
	}
	if !s.dirs[source] {
		return fmt.Errorf("move %s: nothing is there", source)
	}
	for name, size := range s.files {
		if rest, ok := strings.CutPrefix(name, source+"/"); ok {
			delete(s.files, name)
			s.files[path.Join(target, rest)] = size
		}
	}
	for name := range s.dirs {
		if rest, ok := strings.CutPrefix(name, source+"/"); ok {
			delete(s.dirs, name)
			s.dirs[path.Join(target, rest)] = true
		}
	}
	delete(s.dirs, source)
	s.dirs[target] = true
	s.parents(target)
	return nil
}

func (s *Stage) Link(_ context.Context, source, target string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	size, ok := s.files[source]
	if !ok {
		return fmt.Errorf("link %s: nothing is there", source)
	}
	s.files[target] = size
	s.parents(target)
	s.Links[target] = source
	return nil
}

func (s *Stage) Size(_ context.Context, name string) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if size, file := s.files[name]; file {
		return size, nil
	}
	var total int64
	for file, size := range s.files {
		if strings.HasPrefix(file, name+"/") {
			total += size
		}
	}
	return total, nil
}

func (s *Stage) Dirs(context.Context) ([]int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ids := []int{}
	for dir := range s.dirs {
		rest, ok := strings.CutPrefix(dir, StageRoot+"/")
		if id, err := strconv.Atoi(rest); ok && err == nil {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	return ids, nil
}
