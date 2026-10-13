package sevenzip

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	unpackTimeout  = 3 * time.Hour
	packTimeout    = 8 * time.Hour
	progressTail   = 16
	warningsOnly   = 1
	ignoredLink    = "Dangerous link path was ignored"
	errorPrefix    = "ERROR:"
	messageExcerpt = 300
)

var percentShown = regexp.MustCompile(`(\d{1,3})%`)

type progress struct {
	observe func(percent int)
	tail    []byte
	last    int
}

func (p *progress) Write(chunk []byte) (int, error) {
	seen := append(p.tail, chunk...)
	if found := percentShown.FindAllSubmatch(seen, -1); len(found) > 0 {
		if percent, err := strconv.Atoi(string(found[len(found)-1][1])); err == nil && percent != p.last && percent <= 100 {
			p.last = percent
			p.observe(percent)
		}
	}
	p.tail = append(p.tail[:0], seen[max(0, len(seen)-progressTail):]...)
	return len(chunk), nil
}

func (t *Tool) watched(ctx context.Context, timeout time.Duration, dir string, observe func(percent int), args ...string) (scan.ToolRun, error) {
	binary := t.current()
	run, err := executeIn(ctx, timeout, binary, dir, &progress{observe: observe, last: -1}, args)
	if err != nil && errors.Is(err, exec.ErrNotFound) && t.fallBack(binary) {
		run, err = executeIn(ctx, timeout, t.current(), dir, &progress{observe: observe, last: -1}, args)
	}
	return run, err
}

func (t *Tool) Unpack(ctx context.Context, in composition.Unpacking, observe func(percent int)) error {
	args := []string{"x", "-y", "-bso0", "-bsp1", "-p-", "-o" + in.Destination}
	if in.Threads > 0 {
		args = append(args, "-mmt="+strconv.Itoa(in.Threads))
	}
	run, err := t.watched(ctx, unpackTimeout, "", observe, append(args, "--", in.Archive)...)
	if err != nil {
		return err
	}
	if run.Failed && run.ExitCode != warningsOnly && !onlyIgnoredLinks(run.Stderr) {
		return fmt.Errorf("unpack %s: %s: %w", filepath.Base(in.Archive), said(run), composition.ErrUnreadable)
	}
	return nil
}

func (t *Tool) Pack(ctx context.Context, in composition.Packing, observe func(percent int)) error {
	args := []string{"a", "-t7z", "-m0=lzma2", "-mx=5", "-ms=off", "-snl", "-y", "-bso0", "-bsp1"}
	if in.Threads > 0 {
		args = append(args, "-mmt="+strconv.Itoa(in.Threads))
	}
	args = append(args, "--", in.Target)
	for _, entry := range in.Entries {
		args = append(args, "./"+entry)
	}
	run, err := t.watched(ctx, packTimeout, in.Root, observe, args...)
	if err != nil {
		return err
	}
	if run.Failed {
		return fmt.Errorf("pack %s: %s", filepath.Base(in.Target), said(run))
	}
	return nil
}

func onlyIgnoredLinks(stderr string) bool {
	ignored := false
	for _, line := range strings.Split(stderr, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case strings.Contains(line, ignoredLink):
			ignored = true
		case strings.HasPrefix(line, errorPrefix):
			return false
		}
	}
	return ignored
}

func said(run scan.ToolRun) string {
	for _, line := range strings.Split(run.Stderr, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			return line[:min(len(line), messageExcerpt)]
		}
	}
	return run.Message
}
