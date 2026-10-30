package download_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func TestTheStageOfAnUploadFollowsItsLastStep(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	at := now.Add(-time.Hour)
	file := func(status int, check download.CheckStatus) *download.UploadTarget {
		return &download.UploadTarget{File: download.File{Type: download.FileTypeObjectStore, Status: status, CheckStatus: check}}
	}
	session := func(status upload.SessionStatus, edit func(*upload.Session)) *upload.Session {
		s := &upload.Session{Status: status, ExpiresAt: now.Add(time.Hour)}
		if edit != nil {
			edit(s)
		}
		return s
	}
	cases := []struct {
		name    string
		session *upload.Session
		target  *download.UploadTarget
		want    download.UploadStage
	}{
		{"failed before a session", nil, nil, download.UploadNotStarted},
		{"uploading", session(upload.StatusUploading, nil), nil, download.UploadUploading},
		{"past its deadline", session(upload.StatusUploading, func(s *upload.Session) { s.ExpiresAt = at }), nil, download.UploadExpired},
		{"finished, not submitted", session(upload.StatusCompleted, nil), nil, download.UploadPending},
		{"cancelled", session(upload.StatusAborted, nil), nil, download.UploadCanceled},
		{"cancelled, then cleaned up", session(upload.StatusExpired, func(s *upload.Session) { s.AbortedAt = &at }), nil, download.UploadCanceled},
		{"expired", session(upload.StatusExpired, nil), nil, download.UploadExpired},
		{"checking", session(upload.StatusCompleted, nil), file(download.FileOnServer, download.CheckPending), download.UploadProcessing},
		{"storing", session(upload.StatusCompleted, nil), file(download.FileOnServer, download.CheckOK), download.UploadProcessing},
		{"held for review", session(upload.StatusCompleted, nil), file(download.FileInObjectStore, download.CheckHarmfulPendingReview), download.UploadProcessing},
		{"check stalled", session(upload.StatusCompleted, nil), file(download.FileOnServer, download.CheckStalled), download.UploadProcessing},
		{"stored", session(upload.StatusCompleted, nil), file(download.FileInObjectStore, download.CheckOK), download.UploadPublished},
		{"encrypted", session(upload.StatusCompleted, nil), file(download.FileOnServer, download.CheckEncrypted), download.UploadRejected},
		{"submitted, file replaced since", session(upload.StatusCompleted, func(s *upload.Session) { s.SubmittedAt = &at }), nil, download.UploadPublished},
		{"handed to a composition", session(upload.StatusExpired, func(s *upload.Session) { s.SubmittedAt, s.CompositionID = &at, ptr(7) }), nil, download.UploadComposed},
		{"handed to a composition before it was recorded", session(upload.StatusExpired, func(s *upload.Session) { s.SubmittedAt = &at }), nil, download.UploadPublished},
	}
	for _, c := range cases {
		if got := download.StageOfUpload(c.session, c.target, now); got != c.want {
			t.Errorf("%s: got %s, want %s", c.name, got, c.want)
		}
	}
	for _, stage := range download.UploadStages() {
		if !stage.Valid() {
			t.Fatalf("%s is a stage", stage)
		}
	}
	if download.UploadStage("lost").Valid() {
		t.Fatal("an unknown stage is not valid")
	}
}
