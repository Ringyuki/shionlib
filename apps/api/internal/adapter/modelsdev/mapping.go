package modelsdev

import "encoding/json"

type providerRecord struct {
	ID     json.RawMessage            `json:"id"`
	Name   json.RawMessage            `json:"name"`
	NPM    json.RawMessage            `json:"npm"`
	API    json.RawMessage            `json:"api"`
	Doc    json.RawMessage            `json:"doc"`
	Models map[string]json.RawMessage `json:"models"`
}

type modelRecord struct {
	ID               json.RawMessage `json:"id"`
	CanonicalModelID json.RawMessage `json:"canonical_model_id"`
	Name             json.RawMessage `json:"name"`
	Type             json.RawMessage `json:"type"`
	Family           json.RawMessage `json:"family"`
	Provider         *struct {
		NPM json.RawMessage `json:"npm"`
	} `json:"provider"`
	Modalities struct {
		Input  []json.RawMessage `json:"input"`
		Output []json.RawMessage `json:"output"`
	} `json:"modalities"`
	Limit struct {
		Context json.RawMessage `json:"context"`
		Output  json.RawMessage `json:"output"`
	} `json:"limit"`
	Temperature      json.RawMessage `json:"temperature"`
	ToolCall         json.RawMessage `json:"tool_call"`
	Reasoning        json.RawMessage `json:"reasoning"`
	StructuredOutput json.RawMessage `json:"structured_output"`
	Cost             struct {
		Input      json.RawMessage   `json:"input"`
		Output     json.RawMessage   `json:"output"`
		CacheRead  json.RawMessage   `json:"cache_read"`
		CacheWrite json.RawMessage   `json:"cache_write"`
		Tiers      []json.RawMessage `json:"tiers"`
	} `json:"cost"`
	ReleaseDate json.RawMessage `json:"release_date"`
}

type tierRecord struct {
	Tier *struct {
		Type json.RawMessage `json:"type"`
		Size json.RawMessage `json:"size"`
	} `json:"tier"`
	Input     json.RawMessage `json:"input"`
	Output    json.RawMessage `json:"output"`
	CacheRead json.RawMessage `json:"cache_read"`
}
