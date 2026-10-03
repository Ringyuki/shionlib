package uploadhttp

import (
	"errors"
	"io"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
)

type trackedBodyInput struct {
	reader io.Reader
	err    error
}

func (b *trackedBodyInput) Read(p []byte) (int, error) {
	n, err := b.reader.Read(p)
	if err != nil && !errors.Is(err, io.EOF) {
		b.err = err
	}
	return n, err
}

func (b *trackedBodyInput) classify(err error) error {
	if b.err == nil {
		return err
	}
	var tooLarge *http.MaxBytesError
	if errors.As(b.err, &tooLarge) {
		return errmap.WithStatus(http.StatusRequestEntityTooLarge, err)
	}
	return errmap.WithStatus(http.StatusBadRequest, err)
}

type uploadSessionPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type initUploadInput struct {
	Body struct {
		FileName   string `json:"file_name" minLength:"1"`
		TotalSize  int64  `json:"total_size"`
		ChunkSize  *int64 `json:"chunk_size,omitempty" minimum:"1"`
		FileSHA256 string `json:"file_sha256" minLength:"1" doc:"BLAKE3 hex digest of the whole file"`
	}
}
