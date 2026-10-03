package openai_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/openai"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

const legacyFormat = `{"type":"json_schema","name":"moderationEvent","strict":true,"schema":{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"decision":{"type":"string","enum":["ALLOW","BLOCK"]},"reason":{"type":"string","maxLength":2550},"evidence":{"type":"string","maxLength":1000},"top_category":{"type":"string","enum":["HARASSMENT","HARASSMENT_THREATENING","SEXUAL","SEXUAL_MINORS","HATE","HATE_THREATENING","ILLICIT","ILLICIT_VIOLENT","SELF_HARM","SELF_HARM_INTENT","SELF_HARM_INSTRUCTIONS","VIOLENCE","VIOLENCE_GRAPHIC","SPAM","MEANINGLESS"]},"categories_json":{"type":"object","properties":{},"additionalProperties":{"type":"boolean"},"required":[]}},"required":["decision","reason","evidence","top_category","categories_json"],"additionalProperties":false}}`

type recorded struct {
	path   string
	auth   string
	body   []byte
	status int
	reply  string
}

func server(t *testing.T, status int, reply string) (*openai.Client, *recorded) {
	t.Helper()
	rec := &recorded{status: status, reply: reply}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec.path = r.URL.Path
		rec.auth = r.Header.Get("Authorization")
		rec.body, _ = io.ReadAll(r.Body)
		w.WriteHeader(rec.status)
		_, _ = w.Write([]byte(rec.reply))
	}))
	t.Cleanup(srv.Close)
	client := openai.NewClient(httpclient.New(httpclient.Options{Timeout: 5 * time.Second}), openai.Options{
		APIKey:          "sk-test",
		BaseURL:         srv.URL + "/v1/",
		ModerationModel: "omni-moderation-latest",
		ReviewModel:     "gpt-5-mini",
	})
	return client, rec
}

func TestScreen(t *testing.T) {
	ctx := context.Background()
	client, rec := server(t, http.StatusOK, `{"id":"modr","model":"omni","results":[{"flagged":false,"categories":{"hate":false,"harassment":false},"category_scores":{"hate":0.2,"harassment":0.01}}]}`)
	screening, err := client.Screen(ctx, "Hello World")
	if err != nil {
		t.Fatal(err)
	}
	if rec.path != "/v1/moderations" || rec.auth != "Bearer sk-test" || string(rec.body) != `{"model":"omni-moderation-latest","input":"Hello World"}` {
		t.Fatalf("unexpected request %s %s %s", rec.path, rec.auth, rec.body)
	}
	if screening.Model != "omni-moderation-latest" || screening.CategoryScores["hate"] != 0.2 || string(screening.Categories) != `{"hate":false,"harassment":false}` ||
		string(screening.Scores) != `{"hate":0.2,"harassment":0.01}` || screening.Decision() != moderation.DecisionReview {
		t.Fatalf("unexpected screening %+v", screening)
	}
}

func TestReview(t *testing.T) {
	ctx := context.Background()
	output := func(text string) string {
		raw, _ := json.Marshal(map[string]any{"output": []any{
			map[string]any{"type": "reasoning", "summary": []any{}},
			map[string]any{"type": "message", "content": []any{map[string]any{"type": "output_text", "text": text}}},
		}})
		return string(raw)
	}
	client, rec := server(t, http.StatusOK, output(`{"decision":"BLOCK","reason":"`+strings.Repeat("r", 3000)+`","evidence":"e","top_category":"HATE","categories_json":{"hate":true}}`))
	verdict, err := client.Review(ctx, moderation.ReviewRequest{Instructions: "rules", Input: "Comment: \"x\""})
	if err != nil {
		t.Fatal(err)
	}
	var sent struct {
		Model string            `json:"model"`
		Input []json.RawMessage `json:"input"`
		Text  struct {
			Format json.RawMessage `json:"format"`
		} `json:"text"`
		Reasoning json.RawMessage `json:"reasoning"`
	}
	if err := json.Unmarshal(rec.body, &sent); err != nil {
		t.Fatal(err)
	}
	if rec.path != "/v1/responses" || sent.Model != "gpt-5-mini" || string(sent.Text.Format) != legacyFormat || string(sent.Reasoning) != `{"effort":"medium"}` ||
		string(sent.Input[0]) != `{"role":"system","content":"rules"}` || string(sent.Input[1]) != `{"role":"user","content":"Comment: \"x\""}` {
		t.Fatalf("unexpected request %s", rec.body)
	}
	if verdict.Model != "gpt-5-mini" || verdict.Decision != moderation.DecisionBlock || len(verdict.Reason) != 2550 || verdict.Evidence != "e" ||
		verdict.TopCategory != moderation.CategoryHate || string(verdict.Categories) != `{"hate":true}` {
		t.Fatalf("unexpected verdict %+v", verdict)
	}
}

func TestFailures(t *testing.T) {
	ctx := context.Background()
	review := func(text string) string {
		raw, _ := json.Marshal(map[string]any{"output": []any{map[string]any{"type": "message", "content": []any{map[string]any{"type": "output_text", "text": text}}}}})
		return string(raw)
	}
	cases := []struct {
		name   string
		status int
		reply  string
		screen bool
	}{
		{"unauthorized", http.StatusUnauthorized, `{"error":{"message":"bad key"}}`, true},
		{"server error", http.StatusBadGateway, `oops`, false},
		{"malformed body", http.StatusOK, `{"results":`, true},
		{"no results", http.StatusOK, `{"results":[]}`, true},
		{"no output", http.StatusOK, `{"output":[]}`, false},
		{"refusal", http.StatusOK, `{"output":[{"type":"message","content":[{"type":"refusal","refusal":"no"}]}]}`, false},
		{"invalid json output", http.StatusOK, review(`not json`), false},
		{"unknown decision", http.StatusOK, review(`{"decision":"MAYBE","reason":"","evidence":"","top_category":"HATE","categories_json":{}}`), false},
		{"unknown category", http.StatusOK, review(`{"decision":"ALLOW","reason":"","evidence":"","top_category":"harassment","categories_json":{}}`), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			client, _ := server(t, c.status, c.reply)
			var err error
			if c.screen {
				_, err = client.Screen(ctx, "x")
			} else {
				_, err = client.Review(ctx, moderation.ReviewRequest{})
			}
			if err == nil || errors.Is(err, moderation.ErrClassifierDisabled) {
				t.Fatalf("expected a retryable failure, got %v", err)
			}
		})
	}
}

func TestTimeoutAndDisabledKey(t *testing.T) {
	ctx := context.Background()
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
		case <-time.After(2 * time.Second):
		}
	}))
	t.Cleanup(slow.Close)
	client := openai.NewClient(httpclient.New(httpclient.Options{Timeout: 5 * time.Second}), openai.Options{APIKey: "k", BaseURL: slow.URL, ScreeningTimeout: 50 * time.Millisecond})
	if _, err := client.Screen(ctx, "x"); err == nil {
		t.Fatal("screening must time out")
	}

	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true }))
	t.Cleanup(srv.Close)
	disabled := openai.NewClient(httpclient.New(httpclient.Options{}), openai.Options{BaseURL: srv.URL})
	if _, err := disabled.Screen(ctx, "x"); !errors.Is(err, moderation.ErrClassifierDisabled) {
		t.Fatalf("screen without key: %v", err)
	}
	if _, err := disabled.Review(ctx, moderation.ReviewRequest{}); !errors.Is(err, moderation.ErrClassifierDisabled) {
		t.Fatalf("review without key: %v", err)
	}
	if called {
		t.Fatal("no request is sent without a key")
	}
}
