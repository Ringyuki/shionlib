package media

import "context"

type Processor interface {
	ToWebP(ctx context.Context, data []byte, bounds Bounds) (Encoded, error)
}

type Store interface {
	PutBytes(ctx context.Context, key string, data []byte, contentType string, metadata map[string]string) error
}
