package email

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

type captured struct {
	path   string
	method string
	query  map[string][]string
	header http.Header
	body   string
}

func server(t *testing.T, status int, reply string) (*httptest.Server, *captured) {
	t.Helper()
	got := &captured{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		got.path, got.method, got.query, got.header, got.body = r.URL.Path, r.Method, r.URL.Query(), r.Header.Clone(), string(raw)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(reply))
	}))
	t.Cleanup(srv.Close)
	return srv, got
}

func settings(provider, endpoint string) Options {
	return Options{Provider: provider, APIKey: "api-key", Endpoint: endpoint, SenderAddress: "noreply@example.test", SenderName: "Shionlib"}
}

func TestElasticReportsRejectedMessages(t *testing.T) {
	srv, _ := server(t, http.StatusOK, `{"success":false,"error":"Incorrect apikey"}`)
	sender := NewSender(settings(ProviderElastic, srv.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}})
	if err == nil || !strings.Contains(err.Error(), "Incorrect apikey") {
		t.Fatalf("a rejected message must fail with the provider's reason, got %v", err)
	}
}

func TestElasticDefaultsToTheOfficialEndpoint(t *testing.T) {
	var target string
	client := &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
		target = r.URL.Scheme + "://" + r.URL.Host + r.URL.Path
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"success":true}`)), Header: http.Header{}}, nil
	})}
	if err := NewSender(settings(ProviderElastic, ""), client).Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err != nil {
		t.Fatal(err)
	}
	if target != ElasticEndpoint {
		t.Fatalf("endpoint %s", target)
	}
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestElasticSendsQueryParameters(t *testing.T) {
	srv, got := server(t, http.StatusOK, `{"success":true}`)
	sender := NewSender(settings(ProviderElastic, srv.URL+"/v2/email/send"), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"user@example.test"}, HTML: "<p>x</p>"}); err != nil {
		t.Fatal(err)
	}
	want := map[string]string{"apikey": "api-key", "subject": "Hi", "from": "noreply@example.test", "fromName": "Shionlib", "senderName": "Shionlib", "to": "user@example.test", "bodyHtml": "<p>x</p>", "isTransactional": "true"}
	for key, value := range want {
		if got.query[key][0] != value {
			t.Fatalf("query %s = %v want %s", key, got.query[key], value)
		}
	}
	if got.method != http.MethodPost || got.body != "" {
		t.Fatalf("elastic expects an empty POST: %s %q", got.method, got.body)
	}
}

func TestElasticFailsOnHTTPErrors(t *testing.T) {
	srv, _ := server(t, http.StatusBadGateway, "down")
	sender := NewSender(settings(ProviderElastic, srv.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err == nil || !strings.Contains(err.Error(), "502") {
		t.Fatalf("expected an upstream error, got %v", err)
	}
}

func TestPostalSendsJSONAndRequiresSuccess(t *testing.T) {
	srv, got := server(t, http.StatusOK, `{"status":"success"}`)
	sender := NewSender(settings(ProviderPostal, srv.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"user@example.test"}, HTML: "<p>x</p>"}); err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(got.body), &body); err != nil {
		t.Fatal(err)
	}
	if body["from"] != `"Shionlib" <noreply@example.test>` || body["html_body"] != "<p>x</p>" || body["subject"] != "Hi" || body["to"].([]any)[0] != "user@example.test" {
		t.Fatalf("unexpected postal body %s", got.body)
	}
	if got.header.Get("X-Server-API-Key") != "api-key" {
		t.Fatalf("missing api key header %v", got.header)
	}
	if got.path != PostalSendPath {
		t.Fatalf("a bare host is completed with the send path: %s", got.path)
	}

	explicit, sent := server(t, http.StatusOK, `{"status":"success"}`)
	sender = NewSender(settings(ProviderPostal, explicit.URL+"/custom/send"), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err != nil || sent.path != "/custom/send" {
		t.Fatalf("an explicit path is kept: %s %v", sent.path, err)
	}

	failing, _ := server(t, http.StatusOK, `{"status":"error","data":{"code":"UnauthenticatedFromAddress","message":"The From address is not authorised"}}`)
	sender = NewSender(settings(ProviderPostal, failing.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err == nil || !strings.Contains(err.Error(), "UnauthenticatedFromAddress") {
		t.Fatalf("a non-success status must fail with Postal's reason, got %v", err)
	}
	malformed, _ := server(t, http.StatusOK, `not json`)
	sender = NewSender(settings(ProviderPostal, malformed.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err == nil {
		t.Fatal("a malformed response must fail")
	}
}

func TestUnknownProvider(t *testing.T) {
	if err := NewSender(settings("smtp", "http://x"), httpclient.New(httpclient.Options{})).Send(context.Background(), Message{To: []string{"a@example.test"}}); err == nil {
		t.Fatal("unknown providers must be rejected")
	}
}
