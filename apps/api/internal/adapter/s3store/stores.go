package s3store

import (
	"context"
	"io"

	"github.com/Ringyuki/shionlib/apps/api/internal/backup"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

type BackupStore struct {
	bucket *Bucket
}

func NewBackupStore(bucket *Bucket) *BackupStore {
	return &BackupStore{bucket: bucket}
}

func (s *BackupStore) Upload(ctx context.Context, key, contentType string, body io.Reader) error {
	return s.bucket.Upload(ctx, key, contentType, body)
}

func (s *BackupStore) List(ctx context.Context, prefix string) ([]backup.Object, error) {
	objects, err := s.bucket.List(ctx, prefix)
	if err != nil {
		return nil, err
	}
	out := make([]backup.Object, len(objects))
	for i, object := range objects {
		out[i] = backup.Object{Key: object.Key, LastModified: object.LastModified}
	}
	return out, nil
}

func (s *BackupStore) Delete(ctx context.Context, key string) error {
	return s.bucket.Delete(ctx, key)
}

type CoverStore struct {
	bucket *Bucket
}

func NewCoverStore(bucket *Bucket) *CoverStore {
	return &CoverStore{bucket: bucket}
}

func (s *CoverStore) Fetch(ctx context.Context, key string, maxBytes int64) (potatovn.Cover, error) {
	data, contentType, err := s.bucket.Get(ctx, key, maxBytes)
	if err != nil {
		return potatovn.Cover{}, err
	}
	return potatovn.Cover{Data: data, ContentType: contentType}, nil
}
