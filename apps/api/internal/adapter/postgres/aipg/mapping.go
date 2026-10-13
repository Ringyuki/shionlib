package aipg

import (
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const (
	maxStatusMessage = 500
	maxErrorMessage  = 500
	hintPrefix       = 3
	hintSuffix       = 4
	hintThreshold    = 12
)

type priceTierRecord struct {
	Over      int      `json:"over"`
	Input     float64  `json:"input"`
	Output    float64  `json:"output"`
	CacheRead *float64 `json:"cache_read"`
}

type messageRecord struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type payloadRecord struct {
	System   string          `json:"system,omitempty"`
	Messages []messageRecord `json:"messages"`
	Schema   json.RawMessage `json:"schema,omitempty"`
}

func keyHint(key string) string {
	runes := []rune(key)
	if len(runes) <= hintThreshold {
		return "…"
	}
	return string(runes[:hintPrefix]) + "…" + string(runes[len(runes)-hintSuffix:])
}

func clip(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func encodeTiers(tiers []ai.PriceTier) (json.RawMessage, error) {
	if len(tiers) == 0 {
		return nil, nil
	}
	records := make([]priceTierRecord, len(tiers))
	for i, tier := range tiers {
		records[i] = priceTierRecord(tier)
	}
	raw, err := json.Marshal(records)
	if err != nil {
		return nil, fmt.Errorf("encode price tiers: %w", err)
	}
	return raw, nil
}

func decodeTiers(raw json.RawMessage) []ai.PriceTier {
	if len(raw) == 0 {
		return nil
	}
	var records []priceTierRecord
	if err := json.Unmarshal(raw, &records); err != nil || len(records) == 0 {
		return nil
	}
	tiers := make([]ai.PriceTier, len(records))
	for i, record := range records {
		tiers[i] = ai.PriceTier(record)
	}
	slices.SortStableFunc(tiers, func(a, b ai.PriceTier) int { return a.Over - b.Over })
	return tiers
}

func encodePayload(payload ai.Payload) (json.RawMessage, error) {
	record := payloadRecord{System: payload.System, Messages: make([]messageRecord, len(payload.Messages))}
	for i, message := range payload.Messages {
		record.Messages[i] = messageRecord{Role: string(message.Role), Content: message.Content}
	}
	if len(payload.Schema) > 0 && json.Valid(payload.Schema) {
		record.Schema = json.RawMessage(payload.Schema)
	}
	raw, err := json.Marshal(record)
	if err != nil {
		return nil, fmt.Errorf("encode request payload: %w", err)
	}
	return raw, nil
}

func decodePayload(row *ent.AIRequestPayload) *ai.Payload {
	if row == nil {
		return nil
	}
	payload := &ai.Payload{Output: row.Output}
	var record payloadRecord
	if err := json.Unmarshal(row.Input, &record); err == nil {
		payload.System = record.System
		for _, message := range record.Messages {
			payload.Messages = append(payload.Messages, ai.Message{Role: ai.Role(message.Role), Content: message.Content})
		}
		if len(record.Schema) > 0 {
			payload.Schema = []byte(record.Schema)
		}
	}
	return payload
}

func toProvider(row *ent.AIProvider) ai.Provider {
	return ai.Provider{
		ID:                row.ID,
		Name:              row.Name,
		Kind:              ai.ProviderKind(row.Kind),
		BaseURL:           row.BaseURL,
		KeyHint:           row.KeyHint,
		PriceMultiplier:   row.PriceMultiplier,
		CatalogProviderID: row.CatalogProviderID,
		Enabled:           row.Enabled,
		Created:           row.Created,
		Updated:           row.Updated,
	}
}

func toProviderRef(row *ent.AIProvider) ai.ProviderRef {
	return ai.ProviderRef{ID: row.ID, Name: row.Name, Kind: ai.ProviderKind(row.Kind)}
}

func toModel(row *ent.AIModel) ai.Model {
	return ai.Model{
		ID:           row.ID,
		Key:          row.Key,
		Name:         row.Name,
		Description:  row.Description,
		CanonicalID:  row.CanonicalID,
		Capabilities: modelCapabilities(row),
		IsDefault:    row.IsDefault,
		Enabled:      row.Enabled,
		Created:      row.Created,
		Updated:      row.Updated,
	}
}

func modelCapabilities(row *ent.AIModel) ai.Capabilities {
	return ai.Capabilities{
		Vision:       row.Vision,
		Moderation:   row.Moderation,
		Temperature:  row.Temperature,
		ToolCall:     row.ToolCall,
		Reasoning:    row.Reasoning,
		ContextLimit: row.ContextLimit,
		OutputLimit:  row.OutputLimit,
	}
}

func toModelRef(row *ent.AIModel) ai.ModelRef {
	return ai.ModelRef{ID: row.ID, Key: row.Key, Name: row.Name, Moderation: row.Moderation}
}

func toModelTarget(row *ent.AIModel) ai.ModelTarget {
	return ai.ModelTarget{
		ID:          row.ID,
		Key:         row.Key,
		Name:        row.Name,
		Temperature: row.Temperature,
		Moderation:  row.Moderation,
		OutputLimit: row.OutputLimit,
		Enabled:     row.Enabled,
	}
}

func routePrice(row *ent.AIRoute) ai.Price {
	return ai.Price{
		Input:      row.InputPrice,
		Output:     row.OutputPrice,
		CacheRead:  row.CacheReadPrice,
		CacheWrite: row.CacheWritePrice,
		Tiers:      decodeTiers(row.PriceTiers),
	}
}

func toRoute(row *ent.AIRoute) ai.Route {
	route := ai.Route{
		ID:            row.ID,
		UpstreamID:    row.UpstreamID,
		Protocol:      ai.Protocol(row.Protocol),
		PriceManual:   row.PriceManual,
		Price:         routePrice(row),
		DroppedParams: nonNil(row.DroppedParams),
		JSONMode:      row.JSONMode,
		Priority:      row.Priority,
		Status:        ai.RouteStatus(row.Status),
		StatusMessage: row.StatusMessage,
		StatusAt:      row.StatusAt,
		Created:       row.Created,
		Updated:       row.Updated,
		Adjustments:   []ai.Adjustment{},
	}
	if row.StatusKind != nil {
		kind := ai.ErrorKind(*row.StatusKind)
		route.StatusKind = &kind
	}
	if model := row.Edges.Model; model != nil {
		route.Model = toModelRef(model)
	} else {
		route.Model = ai.ModelRef{ID: row.ModelID}
	}
	if provider := row.Edges.Provider; provider != nil {
		route.Provider = toProviderRef(provider)
	} else {
		route.Provider = ai.ProviderRef{ID: row.ProviderID}
	}
	for _, adjustment := range row.Edges.Adjustments {
		route.Adjustments = append(route.Adjustments, toAdjustment(adjustment))
	}
	return route
}

func toAdjustment(row *ent.AIRouteAdjustment) ai.Adjustment {
	return ai.Adjustment{
		ID:        row.ID,
		Kind:      ai.AdjustmentKind(row.Kind),
		Value:     row.Value,
		Previous:  row.Previous,
		ErrorKind: ai.ErrorKind(row.ErrorKind),
		RequestID: row.RequestID,
		Created:   row.Created,
	}
}

func toOffer(row *ent.AIProviderOffer) ai.Offer {
	protocols := make([]ai.Protocol, len(row.Protocols))
	for i, protocol := range row.Protocols {
		protocols[i] = ai.Protocol(protocol)
	}
	return ai.Offer{
		ProviderID:  row.ProviderID,
		UpstreamID:  row.UpstreamID,
		Name:        row.Name,
		Protocols:   protocols,
		CanonicalID: row.CanonicalID,
		SyncedAt:    row.SyncedAt,
	}
}

func toSceneConfig(row *ent.AIScene) ai.SceneConfig {
	config := ai.SceneConfig{
		Key:             row.Key,
		ModelID:         row.ModelID,
		Temperature:     row.Temperature,
		MaxOutputTokens: row.MaxOutputTokens,
	}
	if row.TimeoutMs != nil {
		timeout := time.Duration(*row.TimeoutMs) * time.Millisecond
		config.Timeout = &timeout
	}
	return config
}

func toCatalogProvider(row *ent.AICatalogProvider) ai.CatalogProvider {
	return ai.CatalogProvider{ID: row.ID, Name: row.Name, NPM: row.Npm, APIURL: row.APIURL, DocURL: row.DocURL}
}

func toCatalogModel(row *ent.AICatalogModel) ai.CatalogModel {
	return ai.CatalogModel{
		ProviderID:       row.ProviderID,
		ModelKey:         row.ModelKey,
		CanonicalID:      row.CanonicalID,
		Name:             row.Name,
		Type:             row.Type,
		Family:           row.Family,
		NPM:              row.Npm,
		InputModalities:  nonNil(row.InputModalities),
		OutputModalities: nonNil(row.OutputModalities),
		ContextLimit:     row.ContextLimit,
		OutputLimit:      row.OutputLimit,
		Temperature:      row.Temperature,
		ToolCall:         row.ToolCall,
		Reasoning:        row.Reasoning,
		StructuredOutput: row.StructuredOutput,
		InputPrice:       row.InputPrice,
		OutputPrice:      row.OutputPrice,
		CacheReadPrice:   row.CacheReadPrice,
		CacheWritePrice:  row.CacheWritePrice,
		PriceTiers:       decodeTiers(row.PriceTiers),
		ReleaseDate:      row.ReleaseDate,
	}
}

func toRequest(row *ent.AIRequest) ai.Request {
	request := ai.Request{
		ID:           row.ID,
		CallID:       row.CallID,
		Source:       ai.Source(row.Source),
		Scene:        row.Scene,
		RouteID:      row.RouteID,
		UpstreamID:   row.UpstreamID,
		Protocol:     ai.Protocol(row.Protocol),
		OK:           row.Ok,
		ErrorMessage: row.ErrorMessage,
		Adaptation:   row.Adaptation,
		FirstTokenMS: row.FirstTokenMs,
		DurationMS:   row.DurationMs,
		Usage: ai.Usage{
			InputTokens:      row.InputTokens,
			OutputTokens:     row.OutputTokens,
			CacheReadTokens:  row.CacheReadTokens,
			CacheWriteTokens: row.CacheWriteTokens,
			ReasoningTokens:  row.ReasoningTokens,
		},
		CostUSD: row.CostUsd,
		Created: row.Created,
	}
	if row.ErrorKind != nil {
		kind := ai.ErrorKind(*row.ErrorKind)
		request.ErrorKind = &kind
	}
	if model := row.Edges.Model; model != nil {
		ref := toModelRef(model)
		request.Model = &ref
	}
	if provider := row.Edges.Provider; provider != nil {
		ref := toProviderRef(provider)
		request.Provider = &ref
	}
	return request
}

func nonNil[T any](values []T) []T {
	if values == nil {
		return []T{}
	}
	return values
}

func toConnection(row *ent.AIProvider) ai.Connection {
	return ai.Connection{Kind: ai.ProviderKind(row.Kind), BaseURL: row.BaseURL, APIKey: row.APIKey}
}

func toRouteTarget(row *ent.AIRoute) ai.RouteTarget {
	provider := row.Edges.Provider
	return ai.RouteTarget{
		ID:            row.ID,
		ProviderID:    provider.ID,
		ProviderName:  provider.Name,
		Connection:    toConnection(provider),
		UpstreamID:    row.UpstreamID,
		Protocol:      ai.Protocol(row.Protocol),
		Price:         routePrice(row),
		DroppedParams: nonNil(row.DroppedParams),
		JSONMode:      row.JSONMode,
	}
}
