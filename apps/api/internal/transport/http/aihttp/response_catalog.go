package aihttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiCatalogStatusDTO struct {
	Providers int        `json:"providers"`
	Models    int        `json:"models"`
	SyncedAt  *time.Time `json:"synced_at"`
}

type aiCatalogSyncDTO struct {
	Providers int `json:"providers"`
	Models    int `json:"models"`
	Added     int `json:"added"`
	Updated   int `json:"updated"`
	Removed   int `json:"removed"`
	Repriced  int `json:"repriced"`
}

type aiCatalogProviderDTO struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Kind    string  `json:"kind" enum:"compatible,openai,anthropic,google"`
	BaseURL *string `json:"base_url"`
	DocURL  *string `json:"doc_url"`
	Models  int     `json:"models"`
}

type aiCatalogOfferDTO struct {
	Provider    aiProviderRefDTO `json:"provider"`
	UpstreamID  string           `json:"upstream_id"`
	Protocol    string           `json:"protocol"`
	Protocols   []string         `json:"protocols"`
	InputPrice  *float64         `json:"input_price"`
	OutputPrice *float64         `json:"output_price"`
}

type aiCatalogModelDTO struct {
	CanonicalID  string              `json:"canonical_id"`
	Name         string              `json:"name"`
	Lab          string              `json:"lab"`
	Vision       bool                `json:"vision"`
	Moderation   bool                `json:"moderation"`
	Temperature  bool                `json:"temperature"`
	ToolCall     bool                `json:"tool_call"`
	Reasoning    bool                `json:"reasoning"`
	ContextLimit *int                `json:"context_limit"`
	OutputLimit  *int                `json:"output_limit"`
	InputPrice   *float64            `json:"input_price"`
	OutputPrice  *float64            `json:"output_price"`
	ModelID      *int                `json:"model_id"`
	Offers       []aiCatalogOfferDTO `json:"offers"`
}

func toCatalogProviderDTO(entry ai.CatalogProviderEntry) aiCatalogProviderDTO {
	return aiCatalogProviderDTO{ID: entry.ID, Name: entry.Name, Kind: string(entry.Kind), BaseURL: entry.APIURL, DocURL: entry.DocURL, Models: entry.Models}
}

func toCatalogModelDTO(entry ai.CatalogEntry) aiCatalogModelDTO {
	dto := aiCatalogModelDTO{
		CanonicalID:  entry.CanonicalID,
		Name:         entry.Name,
		Lab:          entry.Lab,
		Vision:       entry.Vision,
		Moderation:   entry.Moderation,
		Temperature:  entry.Temperature,
		ToolCall:     entry.ToolCall,
		Reasoning:    entry.Reasoning,
		ContextLimit: entry.ContextLimit,
		OutputLimit:  entry.OutputLimit,
		InputPrice:   entry.InputPrice,
		OutputPrice:  entry.OutputPrice,
		ModelID:      entry.ModelID,
		Offers:       make([]aiCatalogOfferDTO, len(entry.Offers)),
	}
	for i, offer := range entry.Offers {
		dto.Offers[i] = aiCatalogOfferDTO{Provider: toProviderRefDTO(offer.Provider), UpstreamID: offer.UpstreamID, Protocol: string(offer.Protocol), Protocols: protocolStrings(offer.Protocols), InputPrice: offer.InputPrice, OutputPrice: offer.OutputPrice}
	}
	return dto
}
