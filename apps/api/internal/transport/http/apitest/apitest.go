package apitest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var Now = time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)

type Server struct {
	API     *httpapi.API
	Builder *response.Builder
	t       *testing.T
}

func New(t *testing.T) *Server {
	t.Helper()
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	builder := response.NewBuilder(catalog, func() time.Time { return Now })
	api := httpapi.New(httpapi.Options{
		Title:          "test",
		Version:        "test",
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Catalog:        catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver([]netip.Prefix{netip.MustParsePrefix("127.0.0.0/8")}),
		Authenticator:  Authenticator{},
		CORS:           httpapi.CORS{Origins: []string{"*"}},
	})
	return &Server{API: api, Builder: builder, t: t}
}

type Authenticator struct{}

func (Authenticator) Authenticate(_ context.Context, token string) (actor.Actor, error) {
	parts := strings.Split(token, ":")
	if len(parts) != 4 || parts[0] != "user" {
		return actor.Guest(), auth.ErrUnauthorized.Wrap(errors.New("malformed test token"))
	}
	id, idErr := strconv.Atoi(parts[1])
	role, roleErr := strconv.Atoi(parts[2])
	limit, limitErr := strconv.Atoi(parts[3])
	if err := errors.Join(idErr, roleErr, limitErr); err != nil {
		return actor.Guest(), auth.ErrUnauthorized.Wrap(err)
	}
	return actor.Actor{UserID: id, Role: actor.Role(role), ContentLimit: actor.ContentLimit(limit), FamilyID: "family"}, nil
}

func Token(who actor.Actor) string {
	return fmt.Sprintf("user:%d:%d:%d", who.UserID, who.Role, who.ContentLimit)
}

type Response struct {
	Status  int
	Header  http.Header
	Body    []byte
	Code    int
	Message string
	Data    json.RawMessage
	HasData bool
	Meta    json.RawMessage
}

func (r Response) Decode(t *testing.T, target any) {
	t.Helper()
	if err := json.Unmarshal(r.Data, target); err != nil {
		t.Fatalf("decode data %s: %v", r.Data, err)
	}
}

type Request struct {
	Method string
	Path   string
	Body   any
	As     *actor.Actor
	Header map[string]string
}

func (s *Server) Do(req Request) Response {
	s.t.Helper()
	var body io.Reader
	switch typed := req.Body.(type) {
	case nil:
	case string:
		body = strings.NewReader(typed)
	default:
		raw, err := json.Marshal(typed)
		if err != nil {
			s.t.Fatal(err)
		}
		body = strings.NewReader(string(raw))
	}
	httpReq := httptest.NewRequestWithContext(s.t.Context(), req.Method, req.Path, body)
	httpReq.RemoteAddr = "127.0.0.1:4000"
	if body != nil {
		httpReq.Header.Set("Content-Type", "application/json")
	}
	if req.As != nil {
		httpReq.Header.Set("Authorization", "Bearer "+Token(*req.As))
	}
	for key, value := range req.Header {
		httpReq.Header.Set(key, value)
	}
	recorder := httptest.NewRecorder()
	s.API.Handler().ServeHTTP(recorder, httpReq)
	out := Response{Status: recorder.Code, Header: recorder.Header(), Body: recorder.Body.Bytes()}
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(out.Body, &envelope); err != nil {
		s.t.Fatalf("%s %s did not return an envelope: %s", req.Method, req.Path, out.Body)
	}
	if err := json.Unmarshal(envelope["code"], &out.Code); err != nil {
		s.t.Fatalf("missing code in %s", out.Body)
	}
	_ = json.Unmarshal(envelope["message"], &out.Message)
	out.Data, out.HasData = envelope["data"]
	out.Meta = envelope["meta"]
	return out
}

func (s *Server) Expect(resp Response, status, code int) {
	s.t.Helper()
	if resp.Status != status || resp.Code != code {
		s.t.Fatalf("expected status %d code %d, got status %d code %d: %s", status, code, resp.Status, resp.Code, resp.Body)
	}
}
