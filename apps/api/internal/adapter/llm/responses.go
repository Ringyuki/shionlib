package llm

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type responsesMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responsesFormat struct {
	Type   string          `json:"type"`
	Name   string          `json:"name,omitempty"`
	Schema json.RawMessage `json:"schema,omitempty"`
	Strict *bool           `json:"strict,omitempty"`
}

type responsesText struct {
	Format responsesFormat `json:"format"`
}

type responsesRequest struct {
	Model           string             `json:"model"`
	Instructions    string             `json:"instructions,omitempty"`
	Input           []responsesMessage `json:"input"`
	Stream          bool               `json:"stream"`
	Store           bool               `json:"store"`
	Temperature     *float64           `json:"temperature,omitempty"`
	MaxOutputTokens *int               `json:"max_output_tokens,omitempty"`
	Text            *responsesText     `json:"text,omitempty"`
}

type responsesUsage struct {
	InputTokens        int `json:"input_tokens"`
	OutputTokens       int `json:"output_tokens"`
	InputTokensDetails *struct {
		CachedTokens int `json:"cached_tokens"`
	} `json:"input_tokens_details"`
	OutputTokensDetails *struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"output_tokens_details"`
}

type responsesError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type responsesContent struct {
	Type    string `json:"type"`
	Text    string `json:"text"`
	Refusal string `json:"refusal"`
}

type responsesOutput struct {
	Type    string             `json:"type"`
	Content []responsesContent `json:"content"`
}

type responsesObject struct {
	Object            string `json:"object"`
	Status            string `json:"status"`
	IncompleteDetails *struct {
		Reason string `json:"reason"`
	} `json:"incomplete_details"`
	Error  *responsesError   `json:"error"`
	Output []responsesOutput `json:"output"`
	Usage  *responsesUsage   `json:"usage"`
}

type responsesEvent struct {
	Type     string           `json:"type"`
	Delta    string           `json:"delta"`
	Code     string           `json:"code"`
	Message  string           `json:"message"`
	Response *responsesObject `json:"response"`
	responsesObject
}

func responsesBody(request ai.Generation) responsesRequest {
	body := responsesRequest{
		Model:           request.Route.UpstreamID,
		Instructions:    systemPrompt(request),
		Stream:          true,
		Temperature:     temperature(request),
		MaxOutputTokens: maxOutputTokens(request),
	}
	for _, message := range request.Prompt.Messages {
		body.Input = append(body.Input, responsesMessage{Role: string(message.Role), Content: message.Content})
	}
	if structured(request) {
		if request.Route.JSONMode {
			body.Text = &responsesText{Format: responsesFormat{Type: "json_object"}}
		} else {
			strict := false
			body.Text = &responsesText{Format: responsesFormat{Type: "json_schema", Name: schemaName(request), Schema: request.Schema, Strict: &strict}}
		}
	}
	return body
}

func handleResponses(event sseEvent, state *streamState) (*ai.Failure, error) {
	var payload responsesEvent
	if err := json.Unmarshal([]byte(event.Data), &payload); err != nil {
		return nil, fmt.Errorf("decode responses event: %w", err)
	}
	kind := payload.Type
	if kind == "" {
		kind = event.Name
	}
	if kind == "" && payload.Object == "response" {
		return finishResponse(&payload.responsesObject, state, true), nil
	}
	switch kind {
	case "response.output_text.delta":
		state.write(payload.Delta)
	case "response.reasoning_summary_text.delta", "response.reasoning_text.delta", "response.function_call_arguments.delta":
		state.token()
	case "response.refusal.delta":
		state.token()
		state.finished(ai.FinishContentFilter)
	case "response.completed", "response.incomplete":
		if payload.Response == nil {
			return nil, fmt.Errorf("%s without a response", kind)
		}
		return finishResponse(payload.Response, state, false), nil
	case "response.failed":
		if payload.Response == nil || payload.Response.Error == nil {
			return streamFailure(state.url, "server_error", "the response failed", event.Data, 0), nil
		}
		return streamFailure(state.url, payload.Response.Error.Code, payload.Response.Error.Message, event.Data, 0), nil
	case "error":
		if payload.Code == "" && payload.Message == "" && payload.Error != nil {
			return streamFailure(state.url, payload.Error.Code, payload.Error.Message, event.Data, 0), nil
		}
		return streamFailure(state.url, payload.Code, payload.Message, event.Data, 0), nil
	}
	return nil, nil
}

func finishResponse(response *responsesObject, state *streamState, collect bool) *ai.Failure {
	if response.Status == "failed" && response.Error != nil {
		return streamFailure(state.url, response.Error.Code, response.Error.Message, "", 0)
	}
	if collect {
		for _, output := range response.Output {
			if output.Type != "message" {
				continue
			}
			for _, content := range output.Content {
				switch content.Type {
				case "output_text":
					state.write(content.Text)
				case "refusal":
					state.token()
					state.finished(ai.FinishContentFilter)
				}
			}
		}
	}
	if response.Usage != nil {
		state.usage = ai.Usage{InputTokens: response.Usage.InputTokens, OutputTokens: response.Usage.OutputTokens}
		if response.Usage.InputTokensDetails != nil {
			state.usage.CacheReadTokens = response.Usage.InputTokensDetails.CachedTokens
		}
		if response.Usage.OutputTokensDetails != nil {
			state.usage.ReasoningTokens = response.Usage.OutputTokensDetails.ReasoningTokens
		}
	}
	switch {
	case state.finish == ai.FinishContentFilter:
	case response.Status == "incomplete" && response.IncompleteDetails != nil && response.IncompleteDetails.Reason == "max_output_tokens":
		state.finished(ai.FinishLength)
	case response.Status == "incomplete" && response.IncompleteDetails != nil && response.IncompleteDetails.Reason == "content_filter":
		state.finished(ai.FinishContentFilter)
	case response.Status == "completed" || response.Status == "":
		state.finished(ai.FinishStop)
	default:
		state.finished(ai.FinishOther)
	}
	state.done = true
	return nil
}
