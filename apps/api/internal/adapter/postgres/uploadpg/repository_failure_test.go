package uploadpg_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func TestRecordFailureKeepsEveryDetail(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewRepository(db.Ent)
	creator := db.User(t)
	session := newSession(t, repo, creator, "/spool/1", time.Now().Add(time.Hour))
	at := time.Date(2026, 10, 14, 8, 55, 20, 0, time.UTC)
	status, ray, chunk := 403, "a4a581a96a8ce353-NRT", 2
	report := upload.FailureReport{
		SessionID: &session.ID,
		Stage:     upload.FailureSending,
		Reason:    "rejected",
		Error:     upload.ClientError{Name: "ApiError", Message: "", Status: &status, Ray: &ray},
		Chunk:     &chunk,
		FileName:  "【PC】罚抄_PLUS.zip",
		FileSize:  6915224321,
		Attempts:  []upload.FailureAttempt{{At: at.Add(-time.Minute), Wait: "network", Error: upload.ClientError{Name: "TypeError", Message: "Network request failed"}}},
		Client:    "0b6c",
		IP:        "2409:8a10:7844:d60::1",
		UserAgent: "Mozilla/5.0",
	}

	id, err := repo.RecordFailure(ctx, creator, report, at)
	if err != nil {
		t.Fatal(err)
	}
	row, err := db.Ent.UploadFailure.Get(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if row.UserID != creator || *row.SessionID != session.ID || row.Stage != "chunk" || *row.Status != 403 || row.Code != nil || row.RequestID != nil || *row.Ray != ray ||
		*row.Chunk != 2 || row.FileName != report.FileName || row.FileSize != report.FileSize || row.IP != report.IP || !row.Created.Equal(at) {
		t.Fatalf("row %+v", row)
	}
	var attempts []map[string]any
	if err := json.Unmarshal(row.Attempts, &attempts); err != nil || len(attempts) != 1 || attempts[0]["wait"] != "network" || attempts[0]["at"] != "2026-10-14T08:54:20Z" {
		t.Fatalf("attempts %s %v", row.Attempts, err)
	}
	if detail := attempts[0]["error"].(map[string]any); detail["name"] != "TypeError" || detail["status"] != nil {
		t.Fatalf("attempt error %v", detail)
	}

	if _, err := repo.RecordFailure(ctx, creator, upload.FailureReport{Stage: upload.FailureReading, Reason: "unreadable", Error: upload.ClientError{Name: "NotReadableError"}}, at); err != nil {
		t.Fatalf("a failure without a session or attempts: %v", err)
	}
}
