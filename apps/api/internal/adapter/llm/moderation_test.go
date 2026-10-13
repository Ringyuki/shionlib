package llm_test

import (
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestClassifyReturnsCategoriesAndScores(t *testing.T) {
	u := newUpstream(t, respondJSON(http.StatusOK, `{"results":[{"flagged":true,"categories":{"violence":true},"category_scores":{"violence":0.91}}]}`))
	route := target(ai.KindOpenAI, ai.ProtocolModeration, u.server.URL+"/v1")
	route.UpstreamID = "omni-moderation-latest"
	classified, err := newClient().Classify(t.Context(), ai.Classification{Route: route, Input: "text"})
	if err != nil {
		t.Fatal(err)
	}
	if string(classified.Categories) != `{"violence":true}` || string(classified.Scores) != `{"violence":0.91}` {
		t.Fatalf("classified %s %s", classified.Categories, classified.Scores)
	}
	sent := u.last(t)
	if sent.Path != "/v1/moderations" || sent.Body["model"] != "omni-moderation-latest" || sent.Body["input"] != "text" || sent.Header.Get("Authorization") != "Bearer sk-test" {
		t.Fatalf("request %s %v", sent.Path, sent.Body)
	}
}

func TestClassifyFailures(t *testing.T) {
	cases := []struct {
		status int
		body   string
		kind   ai.ErrorKind
	}{
		{http.StatusTooManyRequests, `{"error":{"message":"slow down"}}`, ai.ErrorRateLimit},
		{http.StatusOK, `{"results":[]}`, ai.ErrorMalformed},
		{http.StatusOK, `not json`, ai.ErrorProtocol},
	}
	for _, tc := range cases {
		u := newUpstream(t, respondJSON(tc.status, tc.body))
		_, err := newClient().Classify(t.Context(), ai.Classification{Route: target(ai.KindOpenAI, ai.ProtocolModeration, u.server.URL), Input: "text"})
		if failure := failureOf(t, err); failure.Kind != tc.kind {
			t.Fatalf("%d %s: %+v", tc.status, tc.body, failure)
		}
	}
}
