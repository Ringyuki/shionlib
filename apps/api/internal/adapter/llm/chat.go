package llm

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatStreamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

type chatJSONSchema struct {
	Name   string          `json:"name"`
	Schema json.RawMessage `json:"schema"`
	Strict bool            `json:"strict"`
}

type chatResponseFormat struct {
	Type       string          `json:"type"`
	JSONSchema *chatJSONSchema `json:"json_schema,omitempty"`
}

type chatRequest struct {
	Model          string              `json:"model"`
	Messages       []chatMessage       `json:"messages"`
	Stream         bool                `json:"stream"`
	StreamOptions  chatStreamOptions   `json:"stream_options"`
	Temperature    *float64            `json:"temperature,omitempty"`
	MaxTokens      *int                `json:"max_tokens,omitempty"`
	ResponseFormat *chatResponseFormat `json:"response_format,omitempty"`
}

type chatDelta struct {
	Content          *string         `json:"content"`
	ReasoningContent *string         `json:"reasoning_content"`
	Reasoning        *string         `json:"reasoning"`
	Refusal          *string         `json:"refusal"`
	ToolCalls        json.RawMessage `json:"tool_calls"`
}

type chatChoice struct {
	Delta        *chatDelta `json:"delta"`
	Message      *chatDelta `json:"message"`
	FinishReason *string    `json:"finish_reason"`
}

type chatUsage struct {
	PromptTokens         int `json:"prompt_tokens"`
	CompletionTokens     int `json:"completion_tokens"`
	PromptCacheHitTokens int `json:"prompt_cache_hit_tokens"`
	PromptTokensDetails  *struct {
		CachedTokens int `json:"cached_tokens"`
	} `json:"prompt_tokens_details"`
	CompletionTokensDetails *struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
}

type chatError struct {
	Message string          `json:"message"`
	Code    json.RawMessage `json:"code"`
	Type    string          `json:"type"`
}

type chatChunk struct {
	Choices []chatChoice `json:"choices"`
	Usage   *chatUsage   `json:"usage"`
	Error   *chatError   `json:"error"`
}

func chatBody(request ai.Generation) chatRequest {
	body := chatRequest{
		Model:         request.Route.UpstreamID,
		Stream:        true,
		StreamOptions: chatStreamOptions{IncludeUsage: true},
		Temperature:   temperature(request),
		MaxTokens:     maxOutputTokens(request),
	}
	if system := systemPrompt(request); system != "" {
		body.Messages = append(body.Messages, chatMessage{Role: "system", Content: system})
	}
	for _, message := range request.Prompt.Messages {
		body.Messages = append(body.Messages, chatMessage{Role: string(message.Role), Content: message.Content})
	}
	if structured(request) {
		if request.Route.JSONMode {
			body.ResponseFormat = &chatResponseFormat{Type: "json_object"}
		} else {
			body.ResponseFormat = &chatResponseFormat{Type: "json_schema", JSONSchema: &chatJSONSchema{Name: schemaName(request), Schema: request.Schema}}
		}
	}
	return body
}

func handleChat(event sseEvent, state *streamState) (*ai.Failure, error) {
	var chunk chatChunk
	if err := json.Unmarshal([]byte(event.Data), &chunk); err != nil {
		return nil, fmt.Errorf("decode chat chunk: %w", err)
	}
	if chunk.Error != nil {
		code := chunk.Error.Type
		if text, ok := jsonString(chunk.Error.Code); ok {
			code = text
		}
		return streamFailure(state.url, code, chunk.Error.Message, event.Data, 0), nil
	}
	for _, choice := range chunk.Choices {
		for _, part := range []*chatDelta{choice.Delta, choice.Message} {
			if part == nil {
				continue
			}
			if nonEmpty(part.ReasoningContent) || nonEmpty(part.Reasoning) || (len(part.ToolCalls) > 0 && string(part.ToolCalls) != "null") {
				state.token()
			}
			if nonEmpty(part.Refusal) {
				state.token()
				state.finished(ai.FinishContentFilter)
			}
			if part.Content != nil {
				state.write(*part.Content)
			}
		}
		if choice.FinishReason != nil && *choice.FinishReason != "" {
			state.finished(chatFinish(*choice.FinishReason))
		}
	}
	if chunk.Usage != nil {
		state.usage = chatUsageOf(*chunk.Usage)
	}
	return nil, nil
}

func chatFinish(reason string) ai.FinishReason {
	switch reason {
	case "stop":
		return ai.FinishStop
	case "length":
		return ai.FinishLength
	case "content_filter":
		return ai.FinishContentFilter
	case "tool_calls", "function_call":
		return ai.FinishToolCalls
	}
	return ai.FinishOther
}

func chatUsageOf(usage chatUsage) ai.Usage {
	result := ai.Usage{InputTokens: usage.PromptTokens, OutputTokens: usage.CompletionTokens, CacheReadTokens: usage.PromptCacheHitTokens}
	if usage.PromptTokensDetails != nil && usage.PromptTokensDetails.CachedTokens > 0 {
		result.CacheReadTokens = usage.PromptTokensDetails.CachedTokens
	}
	if usage.CompletionTokensDetails != nil {
		result.ReasoningTokens = usage.CompletionTokensDetails.ReasoningTokens
	}
	return result
}

func nonEmpty(value *string) bool {
	return value != nil && *value != ""
}
