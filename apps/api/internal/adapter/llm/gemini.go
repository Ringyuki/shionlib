package llm

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type geminiPart struct {
	Text    string `json:"text"`
	Thought bool   `json:"thought,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiConfig struct {
	Temperature        *float64        `json:"temperature,omitempty"`
	MaxOutputTokens    *int            `json:"maxOutputTokens,omitempty"`
	ResponseMimeType   string          `json:"responseMimeType,omitempty"`
	ResponseJSONSchema json.RawMessage `json:"responseJsonSchema,omitempty"`
}

type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  *geminiConfig   `json:"generationConfig,omitempty"`
}

type geminiChunk struct {
	Candidates []struct {
		Content *struct {
			Parts []struct {
				Text         string          `json:"text"`
				Thought      bool            `json:"thought"`
				FunctionCall json.RawMessage `json:"functionCall"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	PromptFeedback *struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
	UsageMetadata *struct {
		PromptTokenCount        int `json:"promptTokenCount"`
		CandidatesTokenCount    int `json:"candidatesTokenCount"`
		CachedContentTokenCount int `json:"cachedContentTokenCount"`
		ThoughtsTokenCount      int `json:"thoughtsTokenCount"`
	} `json:"usageMetadata"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

func geminiBody(request ai.Generation) geminiRequest {
	body := geminiRequest{}
	if system := systemPrompt(request); system != "" {
		body.SystemInstruction = &geminiContent{Parts: []geminiPart{{Text: system}}}
	}
	for _, message := range request.Prompt.Messages {
		role := "user"
		if message.Role == ai.RoleAssistant {
			role = "model"
		}
		body.Contents = append(body.Contents, geminiContent{Role: role, Parts: []geminiPart{{Text: message.Content}}})
	}
	config := geminiConfig{Temperature: temperature(request), MaxOutputTokens: maxOutputTokens(request)}
	if structured(request) {
		config.ResponseMimeType = "application/json"
		if !request.Route.JSONMode {
			config.ResponseJSONSchema = request.Schema
		}
	}
	if config.Temperature != nil || config.MaxOutputTokens != nil || config.ResponseMimeType != "" {
		body.GenerationConfig = &config
	}
	return body
}

func handleGemini(event sseEvent, state *streamState) (*ai.Failure, error) {
	var chunk geminiChunk
	if err := json.Unmarshal([]byte(event.Data), &chunk); err != nil {
		return nil, fmt.Errorf("decode gemini chunk: %w", err)
	}
	if chunk.Error != nil {
		code := chunk.Error.Status
		if code == "" {
			code = strconv.Itoa(chunk.Error.Code)
		}
		return streamFailure(state.url, code, chunk.Error.Message, event.Data, chunk.Error.Code), nil
	}
	if chunk.PromptFeedback != nil && chunk.PromptFeedback.BlockReason != "" {
		state.finished(ai.FinishContentFilter)
	}
	for _, candidate := range chunk.Candidates {
		if candidate.Content != nil {
			for _, part := range candidate.Content.Parts {
				switch {
				case part.Thought:
					state.token()
				case len(part.FunctionCall) > 0:
					state.token()
				default:
					state.write(part.Text)
				}
			}
		}
		if candidate.FinishReason != "" {
			state.finished(geminiFinish(candidate.FinishReason))
		}
	}
	if chunk.UsageMetadata != nil {
		usage := chunk.UsageMetadata
		state.usage = ai.Usage{
			InputTokens:     usage.PromptTokenCount,
			OutputTokens:    usage.CandidatesTokenCount + usage.ThoughtsTokenCount,
			CacheReadTokens: usage.CachedContentTokenCount,
			ReasoningTokens: usage.ThoughtsTokenCount,
		}
	}
	return nil, nil
}

func geminiFinish(reason string) ai.FinishReason {
	switch reason {
	case "STOP":
		return ai.FinishStop
	case "MAX_TOKENS":
		return ai.FinishLength
	case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY":
		return ai.FinishContentFilter
	case "MALFORMED_FUNCTION_CALL":
		return ai.FinishToolCalls
	}
	return ai.FinishOther
}
