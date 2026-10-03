package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type moderationRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type moderationResponse struct {
	Results []struct {
		Categories     json.RawMessage `json:"categories"`
		CategoryScores json.RawMessage `json:"category_scores"`
	} `json:"results"`
}

func (c *Client) Classify(ctx context.Context, request ai.Classification) (ai.Classified, error) {
	route := request.Route
	url := c.Endpoint(ai.RouteTarget{Connection: route.Connection, UpstreamID: route.UpstreamID, Protocol: ai.ProtocolModeration})
	ctx, cancel := context.WithTimeout(ctx, idleTimeout(request.IdleTimeout))
	defer cancel()
	resp, err := c.send(ctx, http.MethodPost, url, headers(route.Connection, ai.ProtocolModeration), moderationRequest{Model: route.UpstreamID, Input: request.Input})
	if err != nil {
		return ai.Classified{}, transportFailure(ctx, err, url)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ai.Classified{}, responseFailure(resp, url)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBody))
	if err != nil {
		return ai.Classified{}, transportFailure(ctx, err, url)
	}
	var parsed moderationResponse
	if err := json.Unmarshal(data, &parsed); err != nil {
		return ai.Classified{}, protocolFailure(url, "unexpected moderation response: "+err.Error(), string(data))
	}
	if len(parsed.Results) == 0 || !isObject(parsed.Results[0].Categories) || !isObject(parsed.Results[0].CategoryScores) {
		return ai.Classified{}, &ai.Failure{Kind: ai.ErrorMalformed, Message: "the moderation response has no result", Detail: clip(url+"\n"+string(data), maxFailureBody)}
	}
	return ai.Classified{Categories: parsed.Results[0].Categories, Scores: parsed.Results[0].CategoryScores}, nil
}

func isObject(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && trimmed[0] == '{' && json.Valid(trimmed)
}
