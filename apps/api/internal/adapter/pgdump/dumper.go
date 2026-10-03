package pgdump

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const (
	stderrTail = 4096
	waitDelay  = 5 * time.Second
)

var libpqParameters = map[string]bool{
	"host": true, "hostaddr": true, "port": true, "dbname": true, "user": true, "passfile": true,
	"channel_binding": true, "connect_timeout": true, "client_encoding": true, "options": true,
	"application_name": true, "fallback_application_name": true, "keepalives": true, "keepalives_idle": true,
	"keepalives_interval": true, "keepalives_count": true, "tcp_user_timeout": true, "sslmode": true,
	"requiressl": true, "sslnegotiation": true, "sslcompression": true, "sslcert": true, "sslkey": true,
	"sslpassword": true, "sslcertmode": true, "sslrootcert": true, "sslcrl": true, "sslcrldir": true,
	"sslsni": true, "requirepeer": true, "ssl_min_protocol_version": true, "ssl_max_protocol_version": true,
	"krbsrvname": true, "gsslib": true, "gssencmode": true, "gssdelegation": true, "service": true,
	"target_session_attrs": true, "load_balance_hosts": true, "require_auth": true,
}

type Dumper struct {
	binary      string
	databaseURL string
}

func New(binary, databaseURL string) *Dumper {
	return &Dumper{binary: binary, databaseURL: databaseURL}
}

func (d *Dumper) Dump(ctx context.Context) (io.ReadCloser, error) {
	conninfo, password, err := Connection(d.databaseURL)
	if err != nil {
		return nil, err
	}
	cmd := exec.CommandContext(ctx, d.binary, "--format=custom", "--encoding=UTF8", "--no-owner", "--no-privileges", "--dbname="+conninfo)
	if password != "" {
		cmd.Env = append(cmd.Environ(), "PGPASSWORD="+password)
	}
	cmd.WaitDelay = waitDelay
	stderr := &tail{limit: stderrTail}
	cmd.Stderr = stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("pipe pg_dump output: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start pg_dump: %w", err)
	}
	return &stream{cmd: cmd, stdout: stdout, stderr: stderr}, nil
}

func Connection(databaseURL string) (string, string, error) {
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") {
		return "", "", errors.New("DATABASE_URL must be a postgres:// URL for backups")
	}
	password, _ := parsed.User.Password()
	if parsed.User != nil {
		parsed.User = url.User(parsed.User.Username())
	}
	query := url.Values{}
	for key, values := range parsed.Query() {
		if key == "password" {
			if password == "" && len(values) > 0 {
				password = values[0]
			}
			continue
		}
		if libpqParameters[key] {
			query[key] = values
		}
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), password, nil
}

type stream struct {
	cmd    *exec.Cmd
	stdout io.ReadCloser
	stderr *tail
	read   int64
	done   bool
	err    error
}

func (s *stream) Read(p []byte) (int, error) {
	if s.done {
		return 0, s.err
	}
	n, err := s.stdout.Read(p)
	s.read += int64(n)
	if errors.Is(err, io.EOF) {
		s.done = true
		s.err = s.finish()
		return n, s.err
	}
	return n, err
}

func (s *stream) finish() error {
	if err := s.cmd.Wait(); err != nil {
		return fmt.Errorf("pg_dump failed: %w: %s", err, strings.TrimSpace(s.stderr.String()))
	}
	if s.read == 0 {
		return errors.New("pg_dump produced an empty dump")
	}
	return io.EOF
}

func (s *stream) Close() error {
	if s.done {
		return nil
	}
	s.done = true
	s.err = errors.New("pg_dump stream closed before completion")
	if s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
	_ = s.cmd.Wait()
	return nil
}

type tail struct {
	mu    sync.Mutex
	limit int
	buf   []byte
}

func (t *tail) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf = append(t.buf, p...)
	if over := len(t.buf) - t.limit; over > 0 {
		t.buf = t.buf[over:]
	}
	return len(p), nil
}

func (t *tail) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return string(t.buf)
}
