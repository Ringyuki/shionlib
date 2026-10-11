package objectstore

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

type PreviewStore struct {
	store *Store
}

func NewPreviewStore(store *Store) *PreviewStore {
	return &PreviewStore{store: store}
}

func (p *PreviewStore) PutBytes(ctx context.Context, key string, data []byte, contentType string, metadata map[string]string) error {
	return p.store.PutBytes(ctx, key, data, contentType, metadata)
}

func (p *PreviewStore) GetBytes(ctx context.Context, key string, limit int64) ([]byte, error) {
	if p.store.bucket == "" {
		return nil, errors.New("object store bucket is not configured")
	}
	out, err := p.store.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(p.store.bucket), Key: aws.String(key)})
	var missing *types.NoSuchKey
	if errors.As(err, &missing) {
		return nil, inspection.ErrNoPreview
	}
	if err != nil {
		return nil, fmt.Errorf("get object %s: %w", key, err)
	}
	defer func() { _ = out.Body.Close() }()
	data, err := io.ReadAll(io.LimitReader(out.Body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("read object %s: %w", key, err)
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("object %s is larger than %d bytes", key, limit)
	}
	return data, nil
}

func (p *PreviewStore) Delete(ctx context.Context, key string) error {
	return p.store.Delete(ctx, key)
}
