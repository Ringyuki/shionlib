package llm

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const toolDescription = "Return the result"

type messagesMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type messagesTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

type messagesToolChoice struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

type messagesRequest struct {
	Model       string              `json:"model"`
	System      string              `json:"system,omitempty"`
	Messages    []messagesMessage   `json:"messages"`
	MaxTokens   int                 `json:"max_tokens"`
	Temperature *float64            `json:"temperature,omitempty"`
	Stream      bool                `json:"stream"`
	Tools       []messagesTool      `json:"tools,omitempty"`
	ToolChoice  *messagesToolChoice `json:"tool_choice,omitempty"`
}

type messagesUsage struct {
	InputTokens              int  `json:"input_tokens"`
	OutputTokens             *int `json:"output_tokens"`
	CacheReadInputTokens     int  `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int  `json:"cache_creation_input_tokens"`
}

type messagesBlock struct {
	Type  string          `json:"type"`
	Text  string          `json:"text"`
	Input json.RawMessage `json:"input"`
}

type messagesEvent struct {
	Type    string `json:"type"`
	Index   int    `json:"index"`
	Message *struct {
		Usage *messagesUsage `json:"usage"`
	} `json:"message"`
	ContentBlock *messagesBlock `json:"content_block"`
	Delta        *struct {
		Type        string `json:"type"`
		Text        string `json:"text"`
		Thinking    string `json:"thinking"`
		PartialJSON string `json:"partial_json"`
		StopReason  string `json:"stop_reason"`
	} `json:"delta"`
	Usage *messagesUsage `json:"usage"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
	Content    []messagesBlock `json:"content"`
	StopReason string          `json:"stop_reason"`
}

func structuredTool(request ai.Generation) bool {
	return structured(request) && !request.Route.JSONMode
}

func messagesBody(request ai.Generation, tool bool) messagesRequest {
	body := messagesRequest{
		Model:       request.Route.UpstreamID,
		System:      systemPrompt(request),
		MaxTokens:   defaultMaxTokens,
		Temperature: temperature(request),
		Stream:      true,
	}
	if limit := maxOutputTokens(request); limit != nil {
		body.MaxTokens = *limit
	}
	for _, message := range request.Prompt.Messages {
		body.Messages = append(body.Messages, messagesMessage{Role: string(message.Role), Content: message.Content})
	}
	if tool {
		name := schemaName(request)
		body.Tools = []messagesTool{{Name: name, Description: toolDescription, InputSchema: request.Schema}}
		body.ToolChoice = &messagesToolChoice{Type: "tool", Name: name}
	}
	return body
}

func newMessagesHandler(tool bool) eventHandler {
	toolBlocks := map[int]bool{}
	return func(event sseEvent, state *streamState) (*ai.Failure, error) {
		var payload messagesEvent
		if err := json.Unmarshal([]byte(event.Data), &payload); err != nil {
			return nil, fmt.Errorf("decode messages event: %w", err)
		}
		kind := payload.Type
		if kind == "" {
			kind = event.Name
		}
		switch kind {
		case "message_start":
			if payload.Message != nil && payload.Message.Usage != nil {
				applyMessagesUsage(state, *payload.Message.Usage)
			}
		case "content_block_start":
			if payload.ContentBlock != nil && payload.ContentBlock.Type == "tool_use" {
				toolBlocks[payload.Index] = true
				state.token()
			}
		case "content_block_delta":
			if payload.Delta == nil {
				return nil, nil
			}
			switch payload.Delta.Type {
			case "text_delta":
				if tool {
					state.token()
				} else {
					state.write(payload.Delta.Text)
				}
			case "input_json_delta":
				if tool && toolBlocks[payload.Index] {
					state.write(payload.Delta.PartialJSON)
				} else {
					state.token()
				}
			case "thinking_delta", "signature_delta":
				state.token()
			}
		case "message_delta":
			if payload.Usage != nil {
				applyMessagesUsage(state, *payload.Usage)
			}
			if payload.Delta != nil && payload.Delta.StopReason != "" {
				state.finished(messagesFinish(payload.Delta.StopReason, tool))
			}
		case "message_stop":
			if state.finish == "" {
				state.finished(ai.FinishOther)
			}
			state.done = true
		case "error":
			if payload.Error == nil {
				return streamFailure(state.url, "api_error", "the stream reported an error", event.Data, 0), nil
			}
			return streamFailure(state.url, payload.Error.Type, payload.Error.Message, event.Data, 0), nil
		case "message":
			collectMessage(payload, state, tool)
		}
		return nil, nil
	}
}

func collectMessage(payload messagesEvent, state *streamState, tool bool) {
	for _, block := range payload.Content {
		switch {
		case block.Type == "text" && !tool:
			state.write(block.Text)
		case block.Type == "tool_use" && tool:
			state.write(string(block.Input))
		default:
			state.token()
		}
	}
	if payload.Usage != nil {
		applyMessagesUsage(state, *payload.Usage)
	}
	state.finished(messagesFinish(payload.StopReason, tool))
	state.done = true
}

func applyMessagesUsage(state *streamState, usage messagesUsage) {
	if usage.InputTokens > 0 || usage.CacheReadInputTokens > 0 || usage.CacheCreationInputTokens > 0 {
		state.usage.InputTokens = usage.InputTokens + usage.CacheReadInputTokens + usage.CacheCreationInputTokens
		state.usage.CacheReadTokens = usage.CacheReadInputTokens
		state.usage.CacheWriteTokens = usage.CacheCreationInputTokens
	}
	if usage.OutputTokens != nil {
		state.usage.OutputTokens = *usage.OutputTokens
	}
}

func messagesFinish(reason string, tool bool) ai.FinishReason {
	switch reason {
	case "end_turn", "stop_sequence", "pause_turn":
		return ai.FinishStop
	case "max_tokens", "model_context_window_exceeded":
		return ai.FinishLength
	case "tool_use":
		if tool {
			return ai.FinishStop
		}
		return ai.FinishToolCalls
	case "refusal":
		return ai.FinishContentFilter
	}
	return ai.FinishOther
}
