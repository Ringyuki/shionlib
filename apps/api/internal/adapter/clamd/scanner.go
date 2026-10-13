package clamd

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	defaultChunkSize = 1 << 20
	defaultTimeout   = 2 * time.Minute
	logFileName      = "clamav-scan.log"
	excerptWindow    = 256 << 10
	excerptFallback  = 20
	excerptLimit     = 30
	maxReplyBytes    = 64 << 10
	streamLimit      = 4000 << 20
	scanBytesPerSec  = 5 << 20
	signaturesLayout = "Mon Jan _2 15:04:05 2006"
)

var foundPattern = regexp.MustCompile(`(?i)FOUND`)

type Options struct {
	Address   string
	Timeout   time.Duration
	LogDir    string
	ChunkSize int
}

type Scanner struct {
	address   string
	timeout   time.Duration
	chunkSize int
	logDir    string
	mu        sync.Mutex
	logPath   string
}

func New(opts Options) *Scanner {
	if opts.Timeout <= 0 {
		opts.Timeout = defaultTimeout
	}
	if opts.ChunkSize <= 0 {
		opts.ChunkSize = defaultChunkSize
	}
	return &Scanner{address: opts.Address, timeout: opts.Timeout, chunkSize: opts.ChunkSize, logDir: opts.LogDir}
}

func (s *Scanner) Scan(ctx context.Context, name string, content io.Reader) (scan.Report, error) {
	reply, err := s.stream(ctx, content)
	if err != nil {
		return scan.Report{}, err
	}
	viruses, err := parseReply(reply)
	if err != nil {
		return scan.Report{}, err
	}
	result, err := json.Marshal(struct {
		File       string   `json:"file"`
		IsInfected bool     `json:"isInfected"`
		Viruses    []string `json:"viruses"`
	}{File: name, IsInfected: len(viruses) > 0, Viruses: viruses})
	if err != nil {
		return scan.Report{}, err
	}
	report := scan.Report{Infected: len(viruses) > 0, Viruses: viruses, Result: result}
	if logPath, ok := s.appendLog(name, reply); ok {
		report.LogPath = &logPath
		if report.Infected {
			report.LogExcerpt = excerpt(logPath, name)
		}
	}
	return report, nil
}

func (s *Scanner) MaxSize() int64 {
	return streamLimit
}

func (s *Scanner) Engine(ctx context.Context) (scan.Engine, error) {
	dialer := net.Dialer{Timeout: s.timeout}
	conn, err := dialer.DialContext(ctx, "tcp", s.address)
	if err != nil {
		return scan.Engine{}, fmt.Errorf("dial clamd: %w", err)
	}
	defer func() { _ = conn.Close() }()
	stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
	defer stop()
	if err := s.write(conn, []byte("zVERSION\x00")); err != nil {
		return scan.Engine{}, err
	}
	reply, err := s.readReply(conn, s.timeout)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return scan.Engine{}, ctxErr
		}
		return scan.Engine{}, err
	}
	return parseVersion(reply), nil
}

func parseVersion(reply string) scan.Engine {
	name, rest, _ := strings.Cut(reply, "/")
	engine := scan.Engine{Name: strings.TrimSpace(name)}
	if _, built, found := strings.Cut(rest, "/"); found {
		if at, err := time.Parse(signaturesLayout, strings.TrimSpace(built)); err == nil {
			utc := at.UTC()
			engine.SignaturesAt = &utc
		}
	}
	return engine
}

func (s *Scanner) stream(ctx context.Context, content io.Reader) (string, error) {
	dialer := net.Dialer{Timeout: s.timeout}
	conn, err := dialer.DialContext(ctx, "tcp", s.address)
	if err != nil {
		return "", fmt.Errorf("dial clamd: %w", err)
	}
	defer func() { _ = conn.Close() }()
	stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
	defer stop()
	sent, sendErr := s.send(conn, content)
	if sendErr != nil {
		if reply, readErr := s.readReply(conn, s.timeout); readErr == nil && reply != "" {
			return reply, nil
		}
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", ctxErr
		}
		return "", sendErr
	}
	reply, err := s.readReply(conn, s.timeout+time.Duration(sent/scanBytesPerSec)*time.Second)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", ctxErr
		}
		return "", err
	}
	return reply, nil
}

func (s *Scanner) send(conn net.Conn, file io.Reader) (int64, error) {
	if err := s.write(conn, []byte("zINSTREAM\x00")); err != nil {
		return 0, err
	}
	var sent int64
	buf := make([]byte, 4+s.chunkSize)
	for {
		n, readErr := io.ReadFull(file, buf[4:])
		if n > 0 {
			binary.BigEndian.PutUint32(buf[:4], uint32(n))
			if err := s.write(conn, buf[:4+n]); err != nil {
				return sent, err
			}
			sent += int64(n)
		}
		if errors.Is(readErr, io.EOF) || errors.Is(readErr, io.ErrUnexpectedEOF) {
			break
		}
		if readErr != nil {
			return sent, fmt.Errorf("read file for clamd: %w", readErr)
		}
	}
	return sent, s.write(conn, []byte{0, 0, 0, 0})
}

func (s *Scanner) write(conn net.Conn, data []byte) error {
	if err := conn.SetWriteDeadline(time.Now().Add(s.timeout)); err != nil {
		return fmt.Errorf("set clamd write deadline: %w", err)
	}
	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("write to clamd: %w", err)
	}
	return nil
}

func (s *Scanner) readReply(conn net.Conn, wait time.Duration) (string, error) {
	if err := conn.SetReadDeadline(time.Now().Add(wait)); err != nil {
		return "", fmt.Errorf("set clamd read deadline: %w", err)
	}
	raw, err := bufio.NewReader(io.LimitReader(conn, maxReplyBytes)).ReadString(0)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("read clamd reply: %w", err)
	}
	reply := strings.TrimSpace(strings.TrimRight(raw, "\x00"))
	if reply == "" {
		return "", errors.New("clamd returned an empty reply")
	}
	return reply, nil
}

func parseReply(reply string) ([]string, error) {
	viruses := []string{}
	clean := false
	for line := range strings.SplitSeq(reply, "\n") {
		line = strings.TrimSpace(strings.TrimRight(line, "\x00"))
		if line == "" {
			continue
		}
		switch {
		case strings.HasSuffix(line, "ERROR"):
			return nil, fmt.Errorf("clamd: %s", line)
		case strings.HasSuffix(line, " FOUND"):
			name := strings.TrimSuffix(line, " FOUND")
			if _, after, found := strings.Cut(name, ": "); found {
				name = after
			}
			if name = strings.TrimSpace(name); name != "" {
				viruses = append(viruses, name)
			}
		case strings.HasSuffix(line, "OK"):
			clean = true
		default:
			return nil, fmt.Errorf("clamd: unexpected reply %q", line)
		}
	}
	if len(viruses) == 0 && !clean {
		return nil, fmt.Errorf("clamd: unexpected reply %q", reply)
	}
	return viruses, nil
}

func (s *Scanner) appendLog(path, reply string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.logPath == "" {
		s.logPath = s.resolveLogPath()
	}
	if s.logPath == "" {
		return "", false
	}
	file, err := os.OpenFile(s.logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return s.logPath, true
	}
	defer func() { _ = file.Close() }()
	line := time.Now().UTC().Format(time.RFC3339) + " " + path + ": " + strings.ReplaceAll(reply, "\n", " ") + "\n"
	_, _ = file.WriteString(line)
	return s.logPath, true
}

func (s *Scanner) resolveLogPath() string {
	for _, dir := range []string{s.logDir, os.TempDir()} {
		if dir == "" {
			continue
		}
		if err := os.MkdirAll(dir, 0o750); err != nil {
			continue
		}
		path := filepath.Join(dir, logFileName)
		file, err := os.OpenFile(filepath.Clean(path), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
		if err != nil {
			continue
		}
		_ = file.Close()
		return path
	}
	return ""
}

func excerpt(logPath, scanned string) *string {
	file, err := os.Open(filepath.Clean(logPath))
	if err != nil {
		return nil
	}
	defer func() { _ = file.Close() }()
	info, err := file.Stat()
	if err != nil {
		return nil
	}
	start := max(0, info.Size()-excerptWindow)
	raw := make([]byte, info.Size()-start)
	if _, err := file.ReadAt(raw, start); err != nil && !errors.Is(err, io.EOF) {
		return nil
	}
	var lines []string
	for line := range strings.SplitSeq(strings.ReplaceAll(string(raw), "\r\n", "\n"), "\n") {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			lines = append(lines, trimmed)
		}
	}
	var matched []string
	for _, line := range lines {
		if strings.Contains(line, scanned) || foundPattern.MatchString(line) {
			matched = append(matched, line)
		}
	}
	if len(matched) == 0 {
		matched = lines[max(0, len(lines)-excerptFallback):]
	}
	matched = matched[max(0, len(matched)-excerptLimit):]
	text := strings.TrimSpace(strings.Join(matched, "\n"))
	if text == "" {
		return nil
	}
	return &text
}
