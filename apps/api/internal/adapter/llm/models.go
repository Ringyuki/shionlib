package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const listTimeout = 30 * time.Second

var endpointProtocols = map[string]ai.Protocol{
	"openai":               ai.ProtocolChat,
	"openai-response":      ai.ProtocolResponses,
	"anthropic":            ai.ProtocolMessages,
	"gemini":               ai.ProtocolGemini,
	"openai-completions":   ai.ProtocolChat,
	"openai-responses":     ai.ProtocolResponses,
	"anthropic-messages":   ai.ProtocolMessages,
	"google-generative-ai": ai.ProtocolGemini,
}

type upstreamProtocol struct {
	ID     string `json:"id"`
	Native bool   `json:"native"`
}

type upstreamEntry struct {
	ID                         *string            `json:"id"`
	Name                       *string            `json:"name"`
	DisplayName                *string            `json:"display_name"`
	DisplayNameCamel           *string            `json:"displayName"`
	OwnedBy                    *string            `json:"owned_by"`
	SupportedEndpointTypes     []json.RawMessage  `json:"supported_endpoint_types"`
	Protocols                  []upstreamProtocol `json:"protocols"`
	SupportedGenerationMethods []string           `json:"supportedGenerationMethods"`
}

func (c *Client) ListModels(ctx context.Context, connection ai.Connection) ([]ai.UpstreamModel, error) {
	url := baseURL(connection) + "/models"
	switch connection.Kind {
	case ai.KindGoogle:
		url += "?pageSize=1000"
	case ai.KindAnthropic:
		url += "?limit=1000"
	}
	ctx, cancel := context.WithTimeout(ctx, listTimeout)
	defer cancel()
	resp, err := c.send(ctx, http.MethodGet, url, listHeaders(connection), nil)
	if err != nil {
		return nil, transportFailure(ctx, err, url)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, responseFailure(resp, url)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBody))
	if err != nil {
		return nil, transportFailure(ctx, err, url)
	}
	return parseUpstreamModels(data), nil
}

func listHeaders(connection ai.Connection) http.Header {
	header := http.Header{}
	bearer := "Bearer " + connection.APIKey
	switch connection.Kind {
	case ai.KindGoogle:
		header.Set("x-goog-api-key", connection.APIKey)
	case ai.KindAnthropic:
		header.Set("x-api-key", connection.APIKey)
		header.Set("anthropic-version", anthropicVersion)
		header.Set("Authorization", bearer)
	default:
		header.Set("Authorization", bearer)
	}
	return header
}

func parseUpstreamModels(data []byte) []ai.UpstreamModel {
	var root struct {
		Data   []json.RawMessage `json:"data"`
		Models []json.RawMessage `json:"models"`
	}
	var items []json.RawMessage
	if err := json.Unmarshal(data, &items); err != nil {
		if json.Unmarshal(data, &root) != nil {
			return nil
		}
		items = root.Data
		if items == nil {
			items = root.Models
		}
	}
	models := make([]ai.UpstreamModel, 0, len(items))
	for _, item := range items {
		var entry upstreamEntry
		if json.Unmarshal(item, &entry) != nil {
			continue
		}
		model, ok := upstreamModel(entry)
		if ok {
			models = append(models, model)
		}
	}
	return models
}

func upstreamModel(entry upstreamEntry) (ai.UpstreamModel, bool) {
	var raw string
	switch {
	case entry.ID != nil && *entry.ID != "":
		raw = *entry.ID
	case entry.Name != nil && *entry.Name != "":
		raw = *entry.Name
	default:
		return ai.UpstreamModel{}, false
	}
	model := ai.UpstreamModel{ID: strings.TrimPrefix(raw, "models/"), Owner: entry.OwnedBy}
	switch {
	case entry.SupportedEndpointTypes != nil:
		model.Protocols = []ai.Protocol{}
		for _, item := range entry.SupportedEndpointTypes {
			if name, ok := jsonString(item); ok {
				model.Protocols = appendProtocol(model.Protocols, name)
			}
		}
	case entry.Protocols != nil:
		model.Protocols = []ai.Protocol{}
		for _, item := range entry.Protocols {
			protocol, ok := endpointProtocols[item.ID]
			if !ok {
				continue
			}
			model.Protocols = appendProtocol(model.Protocols, item.ID)
			if item.Native {
				native := protocol
				model.Native = &native
			}
		}
	case entry.SupportedGenerationMethods != nil:
		model.Protocols = []ai.Protocol{}
		if slices.Contains(entry.SupportedGenerationMethods, "generateContent") {
			model.Protocols = []ai.Protocol{ai.ProtocolGemini}
		}
	}
	if model.Protocols != nil && len(model.Protocols) == 0 {
		return ai.UpstreamModel{}, false
	}
	for _, name := range []*string{entry.DisplayName, entry.DisplayNameCamel} {
		if name != nil && *name != "" {
			model.Name = name
			break
		}
	}
	if model.Name == nil && entry.Name != nil && *entry.Name != "" && *entry.Name != raw {
		model.Name = entry.Name
	}
	return model, true
}

func appendProtocol(protocols []ai.Protocol, name string) []ai.Protocol {
	protocol, ok := endpointProtocols[name]
	if !ok || slices.Contains(protocols, protocol) {
		return protocols
	}
	return append(protocols, protocol)
}
