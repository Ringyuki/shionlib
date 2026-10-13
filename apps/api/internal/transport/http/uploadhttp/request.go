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

type uploadClientInput struct {
	Client string `header:"X-Upload-Client" maxLength:"64" pattern:"^[A-Za-z0-9-]*$" doc:"Identifies the browser that uploads; a session held by one client refuses the others"`
}

type heldSessionInput struct {
	Client string `header:"X-Upload-Client" maxLength:"64" pattern:"^[A-Za-z0-9-]*$" doc:"Identifies the browser that uploads; a session held by one client refuses the others"`
	ID     int    `path:"id" minimum:"1"`
}

type holdUploadsInput struct {
	Client string `header:"X-Upload-Client" required:"true" minLength:"8" maxLength:"64" pattern:"^[A-Za-z0-9-]+$" doc:"Identifies the browser that uploads"`
	Body   struct {
		UploadSessionIDs []int `json:"upload_session_ids" minItems:"1" maxItems:"100" doc:"Sessions this client has in its queue"`
	}
}

type initUploadInput struct {
	Client string `header:"X-Upload-Client" maxLength:"64" pattern:"^[A-Za-z0-9-]*$" doc:"Identifies the browser that uploads; the new session is held by it from the start"`
	Body   struct {
		FileName  string `json:"file_name" minLength:"1"`
		TotalSize int64  `json:"total_size"`
		ChunkSize *int64 `json:"chunk_size,omitempty" minimum:"1"`
	}
}

type completeUploadInput struct {
	Client string `header:"X-Upload-Client" maxLength:"64" pattern:"^[A-Za-z0-9-]*$" doc:"Identifies the browser that uploads; a session held by one client refuses the others"`
	ID     int    `path:"id" minimum:"1"`
	Body   struct {
		FileSHA256 string `json:"file_sha256" pattern:"^[0-9a-f]{64}$" doc:"BLAKE3 hex digest of the whole file, computed while uploading"`
	}
}
