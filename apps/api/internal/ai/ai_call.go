package ai

import (
	"bytes"
	"encoding/json"
	"slices"
	"strings"
	"time"
)

type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

func (r Role) Valid() bool {
	return r == RoleUser || r == RoleAssistant
}

type Message struct {
	Role    Role
	Content string
}

type Prompt struct {
	System   string
	Messages []Message
}

func UserPrompt(system, input string) Prompt {
	return Prompt{System: system, Messages: []Message{{Role: RoleUser, Content: input}}}
}

func (p Prompt) LastUserMessage() string {
	for i := len(p.Messages) - 1; i >= 0; i-- {
		if p.Messages[i].Role == RoleUser {
			return p.Messages[i].Content
		}
	}
	return ""
}

type ObjectRequest struct {
	Prompt
	Schema          json.RawMessage
	SchemaName      string
	Temperature     *float64
	MaxOutputTokens *int
	CallID          string
}

type TextRequest struct {
	Prompt
	Temperature     *float64
	MaxOutputTokens *int
	CallID          string
}

type ModerationRequest struct {
	Input  string
	CallID string
}

type ObjectResult struct {
	Model  string
	Output json.RawMessage
	Usage  Usage
}

type TextResult struct {
	Model string
	Text  string
	Usage Usage
}

type ModerationResult struct {
	Model      string
	Categories json.RawMessage
	Scores     json.RawMessage
}

type Connection struct {
	Kind    ProviderKind
	BaseURL *string
	APIKey  string
}

type RouteTarget struct {
	ID            int
	ProviderID    int
	ProviderName  string
	Connection    Connection
	UpstreamID    string
	Protocol      Protocol
	Price         Price
	DroppedParams []string
	JSONMode      bool
}

func (r RouteTarget) Drops(param string) bool {
	return slices.Contains(r.DroppedParams, param)
}

type ModelTarget struct {
	ID          int
	Key         string
	Name        string
	Temperature bool
	Moderation  bool
	OutputLimit *int
	Enabled     bool
}

type Target struct {
	Scene           *string
	Source          Source
	Model           ModelTarget
	Routes          []RouteTarget
	Temperature     *float64
	MaxOutputTokens *int
	IdleTimeout     time.Duration
}

type FinishReason string

const (
	FinishStop          FinishReason = "stop"
	FinishLength        FinishReason = "length"
	FinishContentFilter FinishReason = "content_filter"
	FinishToolCalls     FinishReason = "tool_calls"
	FinishOther         FinishReason = "other"
)

type Generation struct {
	Route           RouteTarget
	Prompt          Prompt
	Schema          json.RawMessage
	SchemaName      string
	Temperature     *float64
	MaxOutputTokens *int
	IdleTimeout     time.Duration
}

type Completion struct {
	Text         string
	FinishReason FinishReason
	Usage        Usage
	FirstToken   time.Duration
}

type Classification struct {
	Route       RouteTarget
	Input       string
	IdleTimeout time.Duration
}

type Classified struct {
	Categories json.RawMessage
	Scores     json.RawMessage
	Usage      Usage
}

func extractJSON(text string) (json.RawMessage, bool) {
	cleaned := stripReasoning(strings.TrimSpace(text))
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(strings.TrimSpace(cleaned), "```")
	cleaned = strings.TrimSpace(cleaned)
	if start, end := strings.IndexByte(cleaned, '{'), strings.LastIndexByte(cleaned, '}'); start > 0 && end > start {
		cleaned = cleaned[start : end+1]
	}
	raw := []byte(cleaned)
	if len(raw) == 0 || raw[0] != '{' || !json.Valid(raw) {
		return nil, false
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, raw); err != nil {
		return nil, false
	}
	return compact.Bytes(), true
}

func stripReasoning(text string) string {
	for {
		start := strings.Index(text, "<think>")
		if start < 0 {
			return strings.TrimSpace(text)
		}
		end := strings.Index(text[start:], "</think>")
		if end < 0 {
			return strings.TrimSpace(text[:start])
		}
		text = text[:start] + text[start+end+len("</think>"):]
	}
}
func jsonObject(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && trimmed[0] == '{' && json.Valid(trimmed)
}
