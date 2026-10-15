package download_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type uploadStore struct {
	listed  []download.Upload
	filter  download.UploadFilter
	session download.UploadDetail
	attempt download.UploadDetail
}

func (s *uploadStore) Uploads(_ context.Context, filter download.UploadFilter, _ download.Page) ([]download.Upload, int, error) {
	s.filter = filter
	return append([]download.Upload{}, s.listed...), len(s.listed), nil
}

func (s *uploadStore) SessionUpload(_ context.Context, id int) (download.UploadDetail, error) {
	if s.session.ID != id {
		return download.UploadDetail{}, upload.ErrSessionNotFound
	}
	return s.session, nil
}

func (s *uploadStore) AttemptUpload(_ context.Context, id int) (download.UploadDetail, error) {
	if s.attempt.ID != id {
		return download.UploadDetail{}, upload.ErrFailureNotFound
	}
	return s.attempt, nil
}

type holders map[int]string

func (h holders) Holders(context.Context, []int) (map[int]string, error) {
	return h, nil
}

type terminator struct {
	ended []int
	err   error
}

func (t *terminator) Terminate(_ context.Context, id int) error {
	t.ended = append(t.ended, id)
	return t.err
}

func TestTheUploadServiceGivesEachUploadItsStage(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	uploading := &upload.Session{ID: 7, Status: upload.StatusUploading, ExpiresAt: now.Add(time.Hour)}
	store := &uploadStore{
		listed:  []download.Upload{{Kind: download.UploadSession, ID: 7, Session: uploading}, {Kind: download.UploadAttempt, ID: 3}},
		session: download.UploadDetail{Upload: download.Upload{Kind: download.UploadSession, ID: 7, Session: uploading}},
		attempt: download.UploadDetail{Upload: download.Upload{Kind: download.UploadAttempt, ID: 3}},
	}
	ends := &terminator{}
	service := download.NewUploadService(download.UploadDeps{Store: store, Holds: holders{7: "browser"}, Uploads: ends, Now: func() time.Time { return now }})

	listed, total, err := service.List(context.Background(), download.UploadFilter{}, download.Page{Number: 1, Size: 20})
	if err != nil || total != 2 || listed[0].Stage != download.UploadUploading || listed[1].Stage != download.UploadNotStarted || !store.filter.Now.Equal(now) {
		t.Fatalf("listed %+v %d %v", listed, total, err)
	}
	detail, err := service.Session(context.Background(), 7)
	if err != nil || detail.Stage != download.UploadUploading || !detail.Held {
		t.Fatalf("session %+v %v", detail, err)
	}
	if _, err := service.Session(context.Background(), 8); !errors.Is(err, upload.ErrSessionNotFound) {
		t.Fatalf("missing session %v", err)
	}
	attempt, err := service.Attempt(context.Background(), 3)
	if err != nil || attempt.Stage != download.UploadNotStarted || attempt.Held {
		t.Fatalf("attempt %+v %v", attempt, err)
	}
	if err := service.Terminate(context.Background(), 7); err != nil || len(ends.ended) != 1 || ends.ended[0] != 7 {
		t.Fatalf("terminate %v %v", err, ends.ended)
	}
}

func TestOnlyUploadsStillOpenAreCheckedForABrowser(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	expired := &upload.Session{ID: 7, Status: upload.StatusExpired}
	store := &uploadStore{session: download.UploadDetail{Upload: download.Upload{Kind: download.UploadSession, ID: 7, Session: expired}}}
	service := download.NewUploadService(download.UploadDeps{Store: store, Holds: holders{7: "stale"}, Uploads: &terminator{}, Now: func() time.Time { return now }})
	detail, err := service.Session(context.Background(), 7)
	if err != nil || detail.Stage != download.UploadExpired || detail.Held {
		t.Fatalf("expired %+v %v", detail, err)
	}
}
