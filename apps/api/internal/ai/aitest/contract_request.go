package aitest

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type RequestLogEnv struct {
	Log  ai.RequestLog
	Repo ai.Repository
}

const (
	callA = "6f1d6d2e-3b9b-4c0d-9a51-0d5c1e4b7a01"
	callB = "6f1d6d2e-3b9b-4c0d-9a51-0d5c1e4b7a02"
	callC = "6f1d6d2e-3b9b-4c0d-9a51-0d5c1e4b7a03"
)

func requestIDs(requests []ai.Request) []int64 {
	ids := make([]int64, len(requests))
	for i, request := range requests {
		ids[i] = request.ID
	}
	return ids
}

func sameJSON(t *testing.T, a, b []byte) bool {
	t.Helper()
	var left, right any
	if json.Unmarshal(a, &left) != nil || json.Unmarshal(b, &right) != nil {
		return false
	}
	return reflect.DeepEqual(left, right)
}

func RequestLogContract(t *testing.T, newEnv func(t *testing.T) RequestLogEnv) {
	t.Run("requests are logged with their payloads and attempts", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		provider := createProvider(t, env.Repo, "relay")
		model := createModel(t, env.Repo, "gpt")
		route := createRoute(t, env.Repo, model, provider, 0)
		scene, reason, firstToken := "moderation_review", ai.FinishLength, 120*time.Millisecond
		failed := must(env.Log.Record(ctx, ai.RequestRecord{
			CallID: callA, Source: ai.SourceScene, Scene: &scene, ModelID: &model, RouteID: &route, ProviderID: &provider,
			UpstreamID: "gpt-5", Protocol: ai.ProtocolChat, Failure: &ai.Failure{Kind: ai.ErrorTimeout, Message: strings.Repeat("m", 600), Detail: "stack"},
			Adaptation: ptr("json_mode"), FinishReason: &reason, FirstToken: &firstToken, Duration: 1500 * time.Millisecond,
			Usage: ai.Usage{InputTokens: 100, OutputTokens: 20, CacheReadTokens: 10, CacheWriteTokens: 5, ReasoningTokens: 7}, CostUSD: 0.0123,
			Created: contractTime,
			Payload: &ai.Payload{System: "sys", Messages: []ai.Message{{Role: ai.RoleUser, Content: "hi"}}, Schema: []byte(`{"type":"object"}`), Output: ptr("{}")},
		}))(t)
		retried := must(env.Log.Record(ctx, ai.RequestRecord{
			CallID: callA, Source: ai.SourceScene, Scene: &scene, ModelID: &model, RouteID: &route, ProviderID: &provider,
			UpstreamID: "gpt-5", Protocol: ai.ProtocolResponses, OK: true, Duration: time.Second, Created: contractTime.Add(time.Second),
		}))(t)
		played := must(env.Log.Record(ctx, ai.RequestRecord{
			CallID: callB, Source: ai.SourcePlayground, UpstreamID: "other", Protocol: ai.ProtocolGemini, OK: true, Created: contractTime.Add(2 * time.Second),
		}))(t)
		page := ai.Page{Number: 1, Size: 10}
		list := func(filter ai.RequestFilter, page ai.Page) ([]int64, int) {
			t.Helper()
			if filter.Since.IsZero() {
				filter.Since = contractTime
			}
			requests, total, err := env.Log.ListRequests(ctx, filter, page)
			if err != nil {
				t.Fatal(err)
			}
			return requestIDs(requests), total
		}
		expect := func(got []int64, total int, want ...int64) {
			t.Helper()
			if !reflect.DeepEqual(got, want) || total != len(want) && len(got) == total {
				t.Fatalf("got %v (total %d), want %v", got, total, want)
			}
		}
		ids, total := list(ai.RequestFilter{}, page)
		expect(ids, total, played, retried, failed)
		ids, total = list(ai.RequestFilter{ModelID: &model}, page)
		expect(ids, total, retried, failed)
		playground, timeout := ai.SourcePlayground, ai.ErrorTimeout
		ids, total = list(ai.RequestFilter{Source: &playground}, page)
		expect(ids, total, played)
		ids, total = list(ai.RequestFilter{OK: ptr(false)}, page)
		expect(ids, total, failed)
		ids, total = list(ai.RequestFilter{ErrorKind: &timeout, Scene: &scene, ProviderID: &provider, RouteID: &route}, page)
		expect(ids, total, failed)
		ids, total = list(ai.RequestFilter{Since: contractTime.Add(time.Second)}, page)
		expect(ids, total, played, retried)
		if ids, total = list(ai.RequestFilter{}, ai.Page{Number: 2, Size: 1}); len(ids) != 1 || ids[0] != retried || total != 3 {
			t.Fatalf("second page %v total %d", ids, total)
		}
		requests, _, err := env.Log.ListRequests(ctx, ai.RequestFilter{Since: contractTime}, page)
		if err != nil {
			t.Fatal(err)
		}
		logged := requests[2]
		if logged.CallID != callA || logged.Source != ai.SourceScene || *logged.Scene != scene || logged.Model == nil || logged.Model.Name != "GPT" ||
			logged.Provider == nil || logged.Provider.Name != "relay" || *logged.RouteID != route || logged.OK || *logged.ErrorKind != ai.ErrorTimeout ||
			len([]rune(*logged.ErrorMessage)) != 500 || *logged.Adaptation != "json_mode" || *logged.FirstTokenMS != 120 || logged.DurationMS != 1500 ||
			logged.Usage != (ai.Usage{InputTokens: 100, OutputTokens: 20, CacheReadTokens: 10, CacheWriteTokens: 5, ReasoningTokens: 7}) ||
			logged.CostUSD != 0.0123 || !logged.Created.Equal(contractTime) || logged.Protocol != ai.ProtocolChat {
			t.Fatalf("logged %+v", logged)
		}
		if anonymous := requests[0]; anonymous.Model != nil || anonymous.Provider != nil || anonymous.RouteID != nil || anonymous.Scene != nil || anonymous.ErrorKind != nil {
			t.Fatalf("anonymous %+v", anonymous)
		}
		detail := must(env.Log.GetRequest(ctx, failed))(t)
		if detail.ID != failed || *detail.ErrorDetail != "stack" || *detail.FinishReason != "length" || detail.Payload == nil ||
			detail.Payload.System != "sys" || !reflect.DeepEqual(detail.Payload.Messages, []ai.Message{{Role: ai.RoleUser, Content: "hi"}}) ||
			!sameJSON(t, detail.Payload.Schema, []byte(`{"type":"object"}`)) || *detail.Payload.Output != "{}" {
			t.Fatalf("detail %+v payload %+v", detail, detail.Payload)
		}
		if plain := must(env.Log.GetRequest(ctx, retried))(t); plain.Payload != nil || plain.ErrorDetail != nil || plain.FinishReason != nil {
			t.Fatalf("plain detail %+v", plain)
		}
		_, err = env.Log.GetRequest(ctx, 987654)
		expectError(t, err, ai.ErrRequestNotFound)
		if attempts := must(env.Log.Attempts(ctx, callA))(t); !reflect.DeepEqual(requestIDs(attempts), []int64{failed, retried}) {
			t.Fatalf("attempts %v", requestIDs(attempts))
		}
		if attempts := must(env.Log.Attempts(ctx, callC))(t); len(attempts) != 0 {
			t.Fatalf("unknown call %v", requestIDs(attempts))
		}
		if purged := must(env.Log.PurgePayloads(ctx, contractTime.Add(500*time.Millisecond)))(t); purged != 1 {
			t.Fatalf("purged payloads %d", purged)
		}
		if detail = must(env.Log.GetRequest(ctx, failed))(t); detail.Payload != nil {
			t.Fatal("purged payloads are gone")
		}
		if purged := must(env.Log.PurgeRequests(ctx, contractTime.Add(1500*time.Millisecond)))(t); purged != 2 {
			t.Fatalf("purged requests %d", purged)
		}
		ids, total = list(ai.RequestFilter{}, page)
		expect(ids, total, played)
	})
}
