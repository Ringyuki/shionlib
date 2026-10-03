package backup

import (
	"context"
	"io"
)

type Dumper interface {
	Dump(ctx context.Context) (io.ReadCloser, error)
}

type Store interface {
	Upload(ctx context.Context, key, contentType string, body io.Reader) error
	List(ctx context.Context, prefix string) ([]Object, error)
	Delete(ctx context.Context, key string) error
}
