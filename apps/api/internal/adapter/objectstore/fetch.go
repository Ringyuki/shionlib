package objectstore

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	fetchDirMode  = 0o750
	fetchFileMode = 0o600
)

func (s *Store) Fetch(ctx context.Context, key, path string) error {
	if s.bucket == "" {
		return errors.New("object store bucket is not configured")
	}
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	var missing *types.NoSuchKey
	if errors.As(err, &missing) {
		return scan.ErrObjectMissing
	}
	if err != nil {
		return fmt.Errorf("get object %s: %w", key, err)
	}
	defer func() { _ = out.Body.Close() }()
	if err := os.MkdirAll(filepath.Dir(path), fetchDirMode); err != nil {
		return fmt.Errorf("create the folder for object %s: %w", key, err)
	}
	file, err := os.OpenFile(filepath.Clean(path), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, fetchFileMode)
	if err != nil {
		return fmt.Errorf("create the file for object %s: %w", key, err)
	}
	if _, err := io.Copy(file, out.Body); err != nil {
		_ = file.Close()
		return fmt.Errorf("download object %s: %w", key, err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("finish the file of object %s: %w", key, err)
	}
	return nil
}
