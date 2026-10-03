package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const (
	defaultIdleTimeout = 120 * time.Second
	defaultMaxTokens   = 4096
	defaultSchemaName  = "result"
	anthropicVersion   = "2023-06-01"
	jsonInstruction    = "Reply with only a JSON object that matches this JSON schema:\n"
)

var defaultBaseURLs = map[ai.ProviderKind]string{
	ai.KindOpenAI:    "https://api.openai.com/v1",
	ai.KindAnthropic: "https://api.anthropic.com/v1",
	ai.KindGoogle:    "https://generativelanguage.googleapis.com/v1beta",
}

type Client struct {
	http *http.Client
}

func NewClient(httpClient *http.Client) *Client {
	return &Client{http: httpClient}
}

func (c *Client) Generate(ctx context.Context, request ai.Generation) (ai.Completion, error) {
	route := request.Route
	var (
		body    any
		handler eventHandler
	)
	switch route.Protocol {
	case ai.ProtocolChat:
		body, handler = chatBody(request), handleChat
	case ai.ProtocolResponses:
		body, handler = responsesBody(request), handleResponses
	case ai.ProtocolMessages:
		structured := structuredTool(request)
		body, handler = messagesBody(request, structured), newMessagesHandler(structured)
	case ai.ProtocolGemini:
		body, handler = geminiBody(request), handleGemini
	default:
		return ai.Completion{}, &ai.Failure{Kind: ai.ErrorProtocol, Message: fmt.Sprintf("protocol %q cannot generate text", route.Protocol)}
	}
	url := c.Endpoint(route)
	if route.Protocol == ai.ProtocolGemini {
		url += "?alt=sse"
	}
	state := newStreamState()
	if err := c.stream(ctx, url, headers(route.Connection, route.Protocol), body, idleTimeout(request.IdleTimeout), handler, state); err != nil {
		return ai.Completion{}, err
	}
	return state.completion(), nil
}

func (c *Client) Endpoint(route ai.RouteTarget) string {
	base := baseURL(route.Connection)
	switch route.Protocol {
	case ai.ProtocolResponses:
		return base + "/responses"
	case ai.ProtocolMessages:
		return base + "/messages"
	case ai.ProtocolGemini:
		return base + "/" + geminiModel(route.UpstreamID) + ":streamGenerateContent"
	case ai.ProtocolModeration:
		return base + "/moderations"
	default:
		return base + "/chat/completions"
	}
}

func baseURL(connection ai.Connection) string {
	if connection.BaseURL != nil {
		if trimmed := strings.TrimRight(strings.TrimSpace(*connection.BaseURL), "/"); trimmed != "" {
			return trimmed
		}
	}
	return defaultBaseURLs[connection.Kind]
}

func geminiModel(upstreamID string) string {
	if strings.HasPrefix(upstreamID, "models/") || strings.HasPrefix(upstreamID, "tunedModels/") {
		return upstreamID
	}
	return "models/" + upstreamID
}

func headers(connection ai.Connection, protocol ai.Protocol) http.Header {
	header := http.Header{}
	bearer := "Bearer " + connection.APIKey
	switch protocol {
	case ai.ProtocolMessages:
		header.Set("x-api-key", connection.APIKey)
		header.Set("anthropic-version", anthropicVersion)
		if connection.Kind == ai.KindCompatible {
			header.Set("Authorization", bearer)
		}
	case ai.ProtocolGemini:
		header.Set("x-goog-api-key", connection.APIKey)
		if connection.Kind == ai.KindCompatible {
			header.Set("Authorization", bearer)
		}
	default:
		header.Set("Authorization", bearer)
	}
	return header
}

func (c *Client) send(ctx context.Context, method, url string, header http.Header, body any) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("encode request: %w", err)
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	for key, values := range header {
		req.Header[key] = values
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "text/event-stream, application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s %s: %w", method, url, err)
	}
	return resp, nil
}

func idleTimeout(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultIdleTimeout
	}
	return value
}

func structured(request ai.Generation) bool {
	return len(bytes.TrimSpace(request.Schema)) > 0
}

func schemaName(request ai.Generation) string {
	if request.SchemaName == "" {
		return defaultSchemaName
	}
	return request.SchemaName
}

func systemPrompt(request ai.Generation) string {
	if !structured(request) || !request.Route.JSONMode {
		return request.Prompt.System
	}
	instruction := jsonInstruction + string(bytes.TrimSpace(request.Schema))
	if request.Prompt.System == "" {
		return instruction
	}
	return request.Prompt.System + "\n\n" + instruction
}

func temperature(request ai.Generation) *float64 {
	if request.Route.Drops(ai.ParamTemperature) {
		return nil
	}
	return request.Temperature
}

func maxOutputTokens(request ai.Generation) *int {
	if request.Route.Drops(ai.ParamMaxOutputTokens) {
		return nil
	}
	return request.MaxOutputTokens
}
