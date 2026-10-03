package clamd_test

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/clamd"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var _ scan.VirusScanner = (*clamd.Scanner)(nil)

type fakeClamd struct {
	listener net.Listener
	mu       sync.Mutex
	received [][]byte
	command  string
}

func startFake(t *testing.T, reply func(total int) string, limit int) *fakeClamd {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	fake := &fakeClamd{listener: listener}
	t.Cleanup(func() { _ = listener.Close() })
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			fake.serve(conn, reply, limit)
		}
	}()
	return fake
}

func (f *fakeClamd) serve(conn net.Conn, reply func(total int) string, limit int) {
	defer func() { _ = conn.Close() }()
	reader := bufio.NewReader(conn)
	command, err := reader.ReadString(0)
	if err != nil {
		return
	}
	var data []byte
	for {
		var size [4]byte
		if _, err := io.ReadFull(reader, size[:]); err != nil {
			return
		}
		n := binary.BigEndian.Uint32(size[:])
		if n == 0 {
			break
		}
		chunk := make([]byte, n)
		if _, err := io.ReadFull(reader, chunk); err != nil {
			return
		}
		data = append(data, chunk...)
		if limit > 0 && len(data) > limit {
			break
		}
	}
	f.mu.Lock()
	f.command = command
	f.received = append(f.received, data)
	f.mu.Unlock()
	_, _ = conn.Write([]byte(reply(len(data)) + "\x00"))
}

func (f *fakeClamd) last() (string, []byte) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.received) == 0 {
		return f.command, nil
	}
	return f.command, f.received[len(f.received)-1]
}

func writeFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "upload.sltf")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestCleanStream(t *testing.T) {
	fake := startFake(t, func(int) string { return "stream: OK" }, 0)
	logDir := t.TempDir()
	scanner := clamd.New(clamd.Options{Address: fake.listener.Addr().String(), Timeout: 5 * time.Second, LogDir: logDir, ChunkSize: 3})
	path := writeFile(t, "hello world")
	report, err := scanner.Scan(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}
	command, data := fake.last()
	if command != "zINSTREAM\x00" || string(data) != "hello world" {
		t.Fatalf("server saw %q %q", command, data)
	}
	if report.Infected || len(report.Viruses) != 0 || report.LogExcerpt != nil {
		t.Fatalf("unexpected report %+v", report)
	}
	var result map[string]any
	if err := json.Unmarshal(report.Result, &result); err != nil {
		t.Fatal(err)
	}
	if result["file"] != path || result["isInfected"] != false || len(result["viruses"].([]any)) != 0 {
		t.Fatalf("unexpected result %s", report.Result)
	}
	if report.LogPath == nil || *report.LogPath != filepath.Join(logDir, "clamav-scan.log") {
		t.Fatalf("unexpected log path %v", report.LogPath)
	}
	logged, err := os.ReadFile(*report.LogPath)
	if err != nil || !strings.Contains(string(logged), path+": stream: OK") {
		t.Fatalf("log %q %v", logged, err)
	}
}

func TestInfectedStream(t *testing.T) {
	fake := startFake(t, func(int) string { return "stream: Eicar-Test-Signature FOUND" }, 0)
	scanner := clamd.New(clamd.Options{Address: fake.listener.Addr().String(), Timeout: 5 * time.Second, LogDir: t.TempDir()})
	path := writeFile(t, "X5O!P%@AP")
	report, err := scanner.Scan(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}
	if !report.Infected || len(report.Viruses) != 1 || report.Viruses[0] != "Eicar-Test-Signature" {
		t.Fatalf("unexpected report %+v", report)
	}
	if string(report.Result) != `{"file":"`+path+`","isInfected":true,"viruses":["Eicar-Test-Signature"]}` {
		t.Fatalf("unexpected result %s", report.Result)
	}
	if report.LogExcerpt == nil || !strings.Contains(*report.LogExcerpt, "Eicar-Test-Signature FOUND") {
		t.Fatalf("unexpected excerpt %v", report.LogExcerpt)
	}
}

func TestErrorReplies(t *testing.T) {
	fake := startFake(t, func(int) string { return "INSTREAM size limit exceeded. ERROR" }, 4)
	scanner := clamd.New(clamd.Options{Address: fake.listener.Addr().String(), Timeout: 5 * time.Second, LogDir: t.TempDir(), ChunkSize: 2})
	_, err := scanner.Scan(t.Context(), writeFile(t, strings.Repeat("a", 64)))
	if err == nil || !strings.Contains(err.Error(), "size limit exceeded") {
		t.Fatalf("expected a size limit error, got %v", err)
	}
	unreachable := clamd.New(clamd.Options{Address: "127.0.0.1:1", Timeout: time.Second})
	if _, err := unreachable.Scan(t.Context(), writeFile(t, "x")); err == nil {
		t.Fatal("dial failures must be errors")
	}
	if _, err := scanner.Scan(t.Context(), filepath.Join(t.TempDir(), "missing")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("missing file: %v", err)
	}
}

func TestUnexpectedReply(t *testing.T) {
	fake := startFake(t, func(int) string { return "stream: something odd" }, 0)
	scanner := clamd.New(clamd.Options{Address: fake.listener.Addr().String(), Timeout: 5 * time.Second, LogDir: t.TempDir()})
	if _, err := scanner.Scan(t.Context(), writeFile(t, "x")); err == nil {
		t.Fatal("unexpected replies must fail")
	}
}
