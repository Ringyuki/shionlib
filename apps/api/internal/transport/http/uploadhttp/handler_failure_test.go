package uploadhttp_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func failureBody(stage string) map[string]any {
	return map[string]any{
		"session_id": 1,
		"stage":      stage,
		"reason":     "rejected",
		"error":      map[string]any{"name": "ApiError", "message": "", "status": 403, "ray": "a4a581a96a8ce353-NRT"},
		"chunk":      0,
		"file_name":  "【PC】罚抄_PLUS.zip",
		"file_size":  6915224321,
		"attempts":   []map[string]any{{"at": "2026-10-14T08:55:30Z", "wait": "network", "error": map[string]any{"name": "TypeError", "message": "Network request failed"}}},
	}
}

func TestReportFailure(t *testing.T) {
	e := setup(t)
	session := e.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 2, CreatorID: member.UserID, ExpiresAt: apitest.Now.Add(time.Hour)})
	headers := map[string]string{"X-Upload-Client": "client-1", "User-Agent": "test-agent"}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/failures", Body: failureBody("chunk")}), http.StatusUnauthorized, 200101)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/failures", As: &member, Header: headers, Body: failureBody("chunk")})
	e.server.Expect(resp, http.StatusCreated, 0)
	if string(resp.Data) != `{"id":1}` {
		t.Fatalf("report answers its record: %s", resp.Data)
	}
	got := e.repo.Failures[0].Report
	if *got.SessionID != session.ID || got.Stage != upload.FailureSending || *got.Error.Status != 403 || got.Error.Code != nil || got.Client != "client-1" || got.UserAgent != "test-agent" ||
		len(got.Attempts) != 1 || got.Attempts[0].Wait != "network" || got.FileSize != 6915224321 {
		t.Fatalf("report %+v", got)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/failures", As: &outsider, Body: failureBody("chunk")}), http.StatusForbidden, 480113)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/failures", As: &member, Body: failureBody("upload")}), http.StatusUnprocessableEntity, 100101)
}
