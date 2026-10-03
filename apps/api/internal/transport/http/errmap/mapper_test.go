package errmap_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reqstate"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var (
	now           = time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)
	errMissing    = apperror.Define(999101, "TEST_MISSING", apperror.KindNotFound)
	errNotAllowed = apperror.Define(999102, "TEST_NOT_ALLOWED", apperror.KindPermissionDenied)
)

func newMapper(t *testing.T) *errmap.Mapper {
	t.Helper()
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	return errmap.NewMapper(response.NewBuilder(catalog, func() time.Time { return now }))
}

func requestContext() (context.Context, *reqstate.State) {
	return reqstate.With(requestid.With(context.Background(), "req-12345678"))
}

func TestBusinessErrorsKeepTheirCodeThroughWrapping(t *testing.T) {
	ctx, state := requestContext()
	resp := newMapper(t).FromError(ctx, fmt.Errorf("load favorite: %w", errMissing.New()))
	if resp.GetStatus() != http.StatusNotFound || resp.Code != 999101 || resp.RequestID != "req-12345678" || !resp.Timestamp.Equal(now) {
		t.Fatalf("response %+v", resp)
	}
	if snapshot := state.Snapshot(); !snapshot.HasError || snapshot.BizCode != 999101 {
		t.Fatalf("the access log sees the business code: %+v", snapshot)
	}
	if !errors.Is(resp, errMissing) {
		t.Fatal("the cause stays inspectable")
	}
}

func TestInternalErrorsNeverReachTheClient(t *testing.T) {
	ctx, state := requestContext()
	cause := errors.New(`pq: relation "users" password=hunter2`)
	resp := newMapper(t).FromError(ctx, cause)
	if resp.GetStatus() != http.StatusInternalServerError || resp.Code != http.StatusInternalServerError || resp.Message != "请求失败" {
		t.Fatalf("response %+v", resp)
	}
	raw, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "hunter2") || strings.Contains(string(raw), "relation") {
		t.Fatalf("internal detail leaked: %s", raw)
	}
	if snapshot := state.Snapshot(); !errors.Is(snapshot.Err, cause) {
		t.Fatalf("the cause is kept for the access log: %+v", snapshot)
	}
}

func TestValidationErrorsListTheFields(t *testing.T) {
	ctx, _ := requestContext()
	resp := newMapper(t).FromError(ctx, apperror.ErrValidationFailed.New().WithField("name", "too long"))
	if resp.GetStatus() != http.StatusUnprocessableEntity || resp.Code != 100101 || resp.Data == nil || len(resp.Data.Errors) != 1 {
		t.Fatalf("response %+v", resp)
	}
	raw, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"data":{"errors":[{"field":"name","messages":["too long"]}]}`) {
		t.Fatalf("validation body %s", raw)
	}
}

func TestExplicitStatusesAndAbandonedRequests(t *testing.T) {
	mapper := newMapper(t)
	ctx, _ := requestContext()
	if resp := mapper.FromError(ctx, errmap.WithStatus(http.StatusServiceUnavailable, errors.New("db down"))); resp.GetStatus() != http.StatusServiceUnavailable || resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("explicit status %+v", resp)
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if resp := mapper.FromError(canceled, context.Canceled); resp.GetStatus() != errmap.StatusClientClosedRequest {
		t.Fatalf("abandoned request %+v", resp)
	}
	if resp := mapper.FromError(ctx, context.Canceled); resp.GetStatus() != http.StatusInternalServerError {
		t.Fatalf("a cancellation the client did not cause is a server error: %+v", resp)
	}
}

func TestEveryKindHasAStatus(t *testing.T) {
	if errmap.StatusOf(apperror.KindPermissionDenied) != http.StatusForbidden || errmap.StatusOf(apperror.Kind(200)) != http.StatusInternalServerError {
		t.Fatal("unexpected status mapping")
	}
	if errmap.StatusOf(errNotAllowed.Kind()) != http.StatusForbidden {
		t.Fatal("permission denied maps to 403")
	}
}

func TestWriterSendsTheEnvelope(t *testing.T) {
	ctx, _ := requestContext()
	resp := newMapper(t).FromError(ctx, errMissing.New())
	resp.GetHeaders().Set("Retry-After", "5")
	rec := httptest.NewRecorder()
	errmap.NewWriter(nil).Write(rec, httptest.NewRequestWithContext(ctx, http.MethodGet, "/", nil), resp)
	if rec.Code != http.StatusNotFound || rec.Header().Get("Content-Type") != "application/json; charset=utf-8" || rec.Header().Get("Retry-After") != "5" {
		t.Fatalf("headers %d %v", rec.Code, rec.Header())
	}
	want := `{"code":999101,"message":"shion-biz.TEST_MISSING","data":null,"requestId":"req-12345678","timestamp":"2026-10-03T01:02:03.000Z"}` + "\n"
	if rec.Body.String() != want {
		t.Fatalf("body %s", rec.Body.String())
	}
}
