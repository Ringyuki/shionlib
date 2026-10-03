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
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
)

type captured struct {
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
		got.method, got.query, got.header, got.body = r.Method, r.URL.Query(), r.Header.Clone(), string(raw)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(reply))
	}))
	t.Cleanup(srv.Close)
	return srv, got
}

func settings(provider, endpoint string) Settings {
	return Settings{Provider: provider, APIKey: "api-key", Endpoint: endpoint, SenderAddress: "noreply@example.test", SenderName: "Shionlib"}
}

func TestElasticSendsQueryParameters(t *testing.T) {
	srv, got := server(t, http.StatusOK, `{"success":true}`)
	sender, err := NewSender(settings(ProviderElastic, srv.URL+"/v2/email/send"), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err != nil {
		t.Fatal(err)
	}
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
	sender, _ := NewSender(settings(ProviderElastic, srv.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err == nil || !strings.Contains(err.Error(), "502") {
		t.Fatalf("expected an upstream error, got %v", err)
	}
}

func TestPostalSendsJSONAndRequiresSuccess(t *testing.T) {
	srv, got := server(t, http.StatusOK, `{"status":"success"}`)
	sender, _ := NewSender(settings(ProviderPostal, srv.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
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

	failing, _ := server(t, http.StatusOK, `{"status":"error"}`)
	sender, _ = NewSender(settings(ProviderPostal, failing.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err == nil {
		t.Fatal("a non-success status must fail")
	}
	malformed, _ := server(t, http.StatusOK, `not json`)
	sender, _ = NewSender(settings(ProviderPostal, malformed.URL), httpclient.New(httpclient.Options{Timeout: time.Second}))
	if err := sender.Send(context.Background(), Message{Subject: "Hi", To: []string{"a@example.test"}}); err == nil {
		t.Fatal("a malformed response must fail")
	}
}

func TestUnknownProvider(t *testing.T) {
	if _, err := NewSender(settings("smtp", "http://x"), httpclient.New(httpclient.Options{})); err == nil {
		t.Fatal("unknown providers must be rejected")
	}
}

type recorder struct {
	messages []Message
}

func (r *recorder) Send(_ context.Context, msg Message) error {
	r.messages = append(r.messages, msg)
	return nil
}

func TestMailerRendersLocalizedTemplates(t *testing.T) {
	catalog, err := i18n.Load(i18n.LocaleEN)
	if err != nil {
		t.Fatal(err)
	}
	sent := &recorder{}
	mailer := NewMailer(sent, catalog)
	ctx := i18n.WithLocale(context.Background(), i18n.LocaleZH)
	if err := mailer.SendVerificationCode(ctx, "a@example.test", "ABC123", 30*time.Minute); err != nil {
		t.Fatal(err)
	}
	code := sent.messages[0]
	if code.Subject != catalog.T(i18n.LocaleZH, "message.email.VERIFICATION_CODE_SUBJECT", nil) || !strings.Contains(code.HTML, "ABC123") || !strings.Contains(code.HTML, "30") || code.To[0] != "a@example.test" {
		t.Fatalf("unexpected verification mail %+v", code)
	}
	link := "https://shionlib.com/user/password/forget?token=t&email=a%40example.test"
	if err := mailer.SendPasswordReset(context.Background(), "a@example.test", link, 10*time.Minute); err != nil {
		t.Fatal(err)
	}
	reset := sent.messages[1]
	if reset.Subject != "Reset your Shionlib password" || !strings.Contains(reset.HTML, `href="https://shionlib.com/user/password/forget?token=t&amp;email=a%40example.test"`) || !strings.Contains(reset.HTML, "10 minutes") {
		t.Fatalf("unexpected reset mail %s", reset.HTML)
	}
	if err := mailer.SendVerificationCode(ctx, "", "x", time.Minute); err == nil {
		t.Fatal("a recipient is required")
	}
}
