package localfs

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"lukechampine.com/blake3"
)

const (
	dirMode    = 0o750
	fileMode   = 0o600
	digestSize = 32
	bufferSize = 4 << 20
)

type Spool struct {
	root   string
	suffix string
}

func NewSpool(root, suffix string) *Spool {
	return &Spool{root: filepath.Clean(root), suffix: suffix}
}

func (s *Spool) Path(name string) string {
	return filepath.Join(s.root, name+s.suffix)
}

func (s *Spool) Owns(path string) bool {
	if path == "" {
		return false
	}
	cleaned := filepath.Clean(path)
	if cleaned == s.root {
		return false
	}
	prefix := s.root
	if !strings.HasSuffix(prefix, string(filepath.Separator)) {
		prefix += string(filepath.Separator)
	}
	return strings.HasPrefix(cleaned, prefix)
}

func (s *Spool) Allocate(_ context.Context, path string, size int64) error {
	if err := os.MkdirAll(s.root, dirMode); err != nil {
		return fmt.Errorf("create upload root: %w", err)
	}
	file, err := os.OpenFile(filepath.Clean(path), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, fileMode)
	if err != nil {
		return fmt.Errorf("create upload file: %w", err)
	}
	if err := file.Truncate(size); err != nil {
		return errors.Join(fmt.Errorf("allocate upload file: %w", err), file.Close())
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close upload file: %w", err)
	}
	return nil
}

func (s *Spool) Write(ctx context.Context, path string, offset int64, body io.Reader, length int64) (string, error) {
	file, err := os.OpenFile(filepath.Clean(path), os.O_WRONLY, fileMode)
	if err != nil {
		return "", fmt.Errorf("open upload file: %w", err)
	}
	digest := sha256.New()
	writer := io.MultiWriter(io.NewOffsetWriter(file, offset), digest)
	written, copyErr := io.CopyBuffer(writer, &contextReader{ctx: ctx, reader: io.LimitReader(body, length)}, make([]byte, min(length, bufferSize)+1))
	closeErr := file.Close()
	if copyErr != nil {
		return "", fmt.Errorf("write chunk: %w", copyErr)
	}
	if written < length {
		return "", fmt.Errorf("write chunk: wrote %d of %d bytes: %w", written, length, io.ErrUnexpectedEOF)
	}
	if closeErr != nil {
		return "", fmt.Errorf("close upload file: %w", closeErr)
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

func (s *Spool) DigestRange(ctx context.Context, path string, offset, length int64) (string, error) {
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("open upload file: %w", err)
	}
	defer func() { _ = file.Close() }()
	return digest(ctx, sha256.New(), io.NewSectionReader(file, offset, length))
}

func (s *Spool) Digest(ctx context.Context, path string) (string, error) {
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("open upload file: %w", err)
	}
	defer func() { _ = file.Close() }()
	return digest(ctx, blake3.New(digestSize, nil), file)
}

func digest(ctx context.Context, h hash.Hash, source io.Reader) (string, error) {
	if _, err := io.CopyBuffer(h, &contextReader{ctx: ctx, reader: source}, make([]byte, bufferSize)); err != nil {
		return "", fmt.Errorf("hash upload file: %w", err)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func (s *Spool) Remove(_ context.Context, path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("remove upload file: %w", err)
	}
	return nil
}

func (s *Spool) Exists(_ context.Context, path string) (bool, error) {
	info, err := os.Stat(path)
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("stat upload file: %w", err)
	}
	return info.Mode().IsRegular(), nil
}

func (s *Spool) Stale(ctx context.Context, before time.Time) ([]string, error) {
	entries, err := os.ReadDir(s.root)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list upload root: %w", err)
	}
	var stale []string
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if !entry.Type().IsRegular() || !strings.HasSuffix(entry.Name(), s.suffix) {
			continue
		}
		info, err := entry.Info()
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("stat upload file: %w", err)
		}
		if info.ModTime().Before(before) {
			stale = append(stale, filepath.Join(s.root, entry.Name()))
		}
	}
	return stale, nil
}

type contextReader struct {
	ctx    context.Context
	reader io.Reader
}

func (r *contextReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.reader.Read(p)
}
