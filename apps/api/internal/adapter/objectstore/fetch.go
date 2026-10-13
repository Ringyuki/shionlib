package objectstore

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"golang.org/x/sync/errgroup"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	fetchDirMode  = 0o750
	fetchFileMode = 0o600
	partAttempts  = 3
	partBackoff   = time.Second
)

type progress struct {
	mu       sync.Mutex
	done     int64
	reported int64
	observe  func(done int64)
}

func (p *progress) add(n int64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.done += n
	if p.done > p.reported {
		p.reported = p.done
		p.observe(p.reported)
	}
}

type counted struct {
	target  io.Writer
	written int64
	tally   *progress
}

func (c *counted) Write(chunk []byte) (int, error) {
	written, err := c.target.Write(chunk)
	c.written += int64(written)
	c.tally.add(int64(written))
	return written, err
}

func (s *Store) Fetch(ctx context.Context, key, path string) error {
	return s.Download(ctx, key, path, func(int64) {})
}

func (s *Store) Download(ctx context.Context, key, path string, observe func(done int64)) error {
	if s.bucket == "" {
		return errors.New("object store bucket is not configured")
	}
	first, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key), Range: aws.String(byteRange(0, s.downloadPart))})
	var refused *awshttp.ResponseError
	if errors.As(err, &refused) && refused.HTTPStatusCode() == http.StatusRequestedRangeNotSatisfiable {
		first, err = s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	}
	var missing *types.NoSuchKey
	if errors.As(err, &missing) {
		return scan.ErrObjectMissing
	}
	if err != nil {
		return fmt.Errorf("get object %s: %w", key, err)
	}
	defer func() { _ = first.Body.Close() }()
	if err := os.MkdirAll(filepath.Dir(path), fetchDirMode); err != nil {
		return fmt.Errorf("create the folder for object %s: %w", key, err)
	}
	file, err := os.OpenFile(filepath.Clean(path), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, fetchFileMode)
	if err != nil {
		return fmt.Errorf("create the file for object %s: %w", key, err)
	}
	tally := &progress{observe: observe}
	err = s.receive(ctx, key, file, first, tally)
	if closeErr := file.Close(); err == nil && closeErr != nil {
		err = fmt.Errorf("finish the file of object %s: %w", key, closeErr)
	}
	return err
}

func (s *Store) receive(ctx context.Context, key string, file *os.File, first *s3.GetObjectOutput, tally *progress) error {
	total, ranged := totalOf(first.ContentRange)
	if !ranged {
		if _, err := io.Copy(&counted{target: file, tally: tally}, first.Body); err != nil {
			return fmt.Errorf("download object %s: %w", key, err)
		}
		return nil
	}
	if err := file.Truncate(total); err != nil {
		return fmt.Errorf("size the file of object %s: %w", key, err)
	}
	if _, err := io.Copy(&counted{target: io.NewOffsetWriter(file, 0), tally: tally}, first.Body); err != nil {
		return fmt.Errorf("download the start of object %s: %w", key, err)
	}
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(s.downloadConcurrency)
	for offset := s.downloadPart; offset < total; offset += s.downloadPart {
		length := min(s.downloadPart, total-offset)
		group.Go(func() error {
			return s.part(groupCtx, key, file, offset, length, tally)
		})
	}
	if err := group.Wait(); err != nil {
		return fmt.Errorf("download object %s: %w", key, err)
	}
	return nil
}

func (s *Store) part(ctx context.Context, key string, file *os.File, offset, length int64, tally *progress) error {
	var err error
	for attempt := range partAttempts {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(partBackoff * time.Duration(attempt)):
			}
		}
		var written int64
		written, err = s.fetchPart(ctx, key, file, offset, length, tally)
		if err == nil {
			return nil
		}
		tally.add(-written)
		if ctx.Err() != nil {
			return ctx.Err()
		}
	}
	return fmt.Errorf("bytes %d-%d: %w", offset, offset+length-1, err)
}

func (s *Store) fetchPart(ctx context.Context, key string, file *os.File, offset, length int64, tally *progress) (int64, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key), Range: aws.String(byteRange(offset, length))})
	if err != nil {
		return 0, err
	}
	defer func() { _ = out.Body.Close() }()
	target := &counted{target: io.NewOffsetWriter(file, offset), tally: tally}
	if _, err := io.Copy(target, io.LimitReader(out.Body, length)); err != nil {
		return target.written, err
	}
	if target.written != length {
		return target.written, fmt.Errorf("received %d of %d bytes", target.written, length)
	}
	return target.written, nil
}

func byteRange(offset, length int64) string {
	return fmt.Sprintf("bytes=%d-%d", offset, offset+length-1)
}

func totalOf(contentRange *string) (int64, bool) {
	value := aws.ToString(contentRange)
	_, size, found := strings.Cut(value, "/")
	if !found || size == "*" {
		return 0, false
	}
	total, err := strconv.ParseInt(size, 10, 64)
	return total, err == nil
}
