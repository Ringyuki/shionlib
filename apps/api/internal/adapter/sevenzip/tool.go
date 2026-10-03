package sevenzip

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	preferredBinary = "7zz"
	fallbackBinary  = "7z"
	listTimeout     = 30 * time.Second
	testTimeout     = 10 * time.Minute
	outputLimit     = 64 << 20
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
	binary := t.current()
	run, err := execute(ctx, timeout, binary, args)
	if err != nil && errors.Is(err, exec.ErrNotFound) && t.fallBack(binary) {
		run, err = execute(ctx, timeout, t.current(), args)
	}
	return run, err
}

func execute(ctx context.Context, timeout time.Duration, binary string, args []string) (scan.ToolRun, error) {
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	stdout := &cappedBuffer{limit: outputLimit, overflow: cancel}
	stderr := &cappedBuffer{limit: outputLimit, overflow: cancel}
	cmd := exec.CommandContext(runCtx, binary, args...)
	cmd.Stdout = stdout
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
