package sevenzip

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	preferredBinary = "7zz"
	fallbackBinary  = "7z"
	listTimeout     = 30 * time.Second
	testTimeout     = 10 * time.Minute
	extractTimeout  = 30 * time.Minute
	outputLimit     = 64 << 20
	utcTimes        = "TZ=UTC"
	entryDirMode    = 0o750
	entryFileMode   = 0o600
)

type Tool struct {
	mu     sync.Mutex
	binary string
}

func New(binary string) *Tool {
	if binary == "" {
		binary = preferredBinary
	}
	return &Tool{binary: binary}
}

func (t *Tool) List(ctx context.Context, path string) (scan.ToolRun, error) {
	return t.run(ctx, listTimeout, "l", "-slt", "-p-", path)
}

func (t *Tool) Test(ctx context.Context, path string) (scan.ToolRun, error) {
	return t.run(ctx, testTimeout, "t", "-bb0", "-bd", "-y", "-p-", path)
}

func (t *Tool) Extract(ctx context.Context, path, destination string, selection scan.Selection) (scan.ToolRun, error) {
	args := []string{"x", "-y", "-bd", "-bb0", "-p-", "-ssc-", "-o" + destination}
	for _, extension := range selection.Extensions {
		args = append(args, "-ir!*."+extension)
	}
	for _, name := range selection.Paths {
		args = append(args, "-i!"+name)
	}
	for _, name := range selection.Skip {
		args = append(args, "-x!"+name)
	}
	return t.run(ctx, extractTimeout, append(args, path)...)
}

func (t *Tool) ExtractEntry(ctx context.Context, path, entry, destination, name string) (scan.ToolRun, error) {
	target := filepath.Clean(filepath.Join(destination, filepath.FromSlash(name)))
	if err := os.MkdirAll(filepath.Dir(target), entryDirMode); err != nil {
		return scan.ToolRun{}, fmt.Errorf("prepare %s: %w", target, err)
	}
	out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, entryFileMode)
	if err != nil {
		return scan.ToolRun{}, fmt.Errorf("create %s: %w", target, err)
	}
	run, err := t.runTo(ctx, extractTimeout, out, "x", "-so", "-bd", "-bb0", "-p-", "-ssc-", "--", path, entry)
	if closeErr := out.Close(); err == nil && closeErr != nil {
		err = fmt.Errorf("close %s: %w", target, closeErr)
	}
	return run, err
}

func (t *Tool) current() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.binary
}

func (t *Tool) fallBack(from string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if from != preferredBinary {
		return false
	}
	if t.binary == preferredBinary {
		t.binary = fallbackBinary
	}
	return true
}

func (t *Tool) run(ctx context.Context, timeout time.Duration, args ...string) (scan.ToolRun, error) {
	return t.runTo(ctx, timeout, nil, args...)
}

func (t *Tool) runTo(ctx context.Context, timeout time.Duration, out io.Writer, args ...string) (scan.ToolRun, error) {
	binary := t.current()
	run, err := executeIn(ctx, timeout, binary, "", out, args)
	if err != nil && errors.Is(err, exec.ErrNotFound) && t.fallBack(binary) {
		run, err = executeIn(ctx, timeout, t.current(), "", out, args)
	}
	return run, err
}

func executeIn(ctx context.Context, timeout time.Duration, binary, dir string, watch io.Writer, args []string) (scan.ToolRun, error) {
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	stdout := &cappedBuffer{limit: outputLimit, overflow: cancel}
	stderr := &cappedBuffer{limit: outputLimit, overflow: cancel}
	cmd := exec.CommandContext(runCtx, binary, args...)
	cmd.Env = append(cmd.Environ(), utcTimes)
	cmd.Dir = dir
	cmd.Stdout = stdout
	if watch != nil {
		cmd.Stdout = watch
	}
	cmd.Stderr = stderr
	if err := cmd.Start(); err != nil {
		return scan.ToolRun{}, fmt.Errorf("start %s: %w", binary, err)
	}
	waitErr := cmd.Wait()
	if err := ctx.Err(); err != nil {
		return scan.ToolRun{}, fmt.Errorf("run %s: %w", binary, err)
	}
	run := scan.ToolRun{Stdout: stdout.String(), Stderr: stderr.String(), Overflow: stdout.exceeded || stderr.exceeded}
	if waitErr == nil && !run.Overflow {
		return run, nil
	}
	run.Failed = true
	switch {
	case run.Overflow:
		run.Message = "stdout maxBuffer exceeded"
		run.Killed = true
	case errors.Is(runCtx.Err(), context.DeadlineExceeded):
		run.Message = "command timeout: " + waitErr.Error()
		run.Killed = true
	default:
		run.Message = waitErr.Error()
	}
	var exitErr *exec.ExitError
	if errors.As(waitErr, &exitErr) {
		run.ExitCode = exitErr.ExitCode()
		if run.ExitCode == -1 {
			run.Killed = true
		}
	}
	return run, nil
}

type cappedBuffer struct {
	limit    int
	buf      bytes.Buffer
	exceeded bool
	overflow func()
}

func (b *cappedBuffer) Write(p []byte) (int, error) {
	if b.exceeded {
		return len(p), nil
	}
	room := b.limit - b.buf.Len()
	if len(p) > room {
		b.buf.Write(p[:max(room, 0)])
		b.exceeded = true
		b.overflow()
		return len(p), nil
	}
	return b.buf.Write(p)
}

func (b *cappedBuffer) String() string {
	return b.buf.String()
}
