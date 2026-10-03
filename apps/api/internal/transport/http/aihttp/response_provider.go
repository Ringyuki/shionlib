package aihttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiRouteCountsDTO struct {
	Total     int `json:"total"`
	Active    int `json:"active"`
	Suspended int `json:"suspended"`
	Disabled  int `json:"disabled"`
}

type aiProviderDTO struct {
	ID                int              `json:"id"`
	Name              string           `json:"name"`
	Kind              string           `json:"kind" enum:"compatible,openai,anthropic,google"`
	BaseURL           *string          `json:"base_url"`
	KeyHint           string           `json:"key_hint"`
	PriceMultiplier   float64          `json:"price_multiplier"`
	CatalogProviderID *string          `json:"catalog_provider_id"`
	Enabled           bool             `json:"enabled"`
	Protocols         []string         `json:"protocols"`
	RouteCounts       aiRouteCountsDTO `json:"route_counts"`
	SuspendedKinds    []string         `json:"suspended_kinds"`
	UpstreamIDs       []string         `json:"upstream_ids"`
	Stats             aiStatsDTO       `json:"stats"`
	LastUsedAt        *time.Time       `json:"last_used_at"`
	Created           time.Time        `json:"created"`
	Updated           time.Time        `json:"updated"`
}

type aiProviderDetailDTO struct {
	aiProviderDTO
	Routes []aiRouteDTO `json:"routes"`
}

type aiFailureDetailDTO struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
	Detail  string `json:"detail"`
}

type aiDiscoveredModelDTO struct {
	UpstreamID   string   `json:"upstream_id"`
	Name         string   `json:"name"`
	CanonicalID  *string  `json:"canonical_id"`
	Lab          *string  `json:"lab"`
	Protocol     string   `json:"protocol"`
	Protocols    []string `json:"protocols"`
	Vision       bool     `json:"vision"`
	Moderation   bool     `json:"moderation"`
	ToolCall     bool     `json:"tool_call"`
	Reasoning    bool     `json:"reasoning"`
	ContextLimit *int     `json:"context_limit"`
	InputPrice   *float64 `json:"input_price"`
	OutputPrice  *float64 `json:"output_price"`
	ModelID      *int     `json:"model_id"`
	RouteID      *int     `json:"route_id"`
}

type aiDiscoveryDTO struct {
	Error  *aiFailureDetailDTO    `json:"error"`
	Models []aiDiscoveredModelDTO `json:"models"`
}

type aiAddRoutesDTO struct {
	RouteIDs []int    `json:"route_ids"`
	Skipped  []string `json:"skipped"`
}

type aiResolvedModelDTO struct {
	UpstreamID  string  `json:"upstream_id"`
	ModelID     *int    `json:"model_id"`
	ModelName   *string `json:"model_name"`
	CanonicalID *string `json:"canonical_id"`
	CatalogName *string `json:"catalog_name"`
}

type aiEndpointDTO struct {
	URL *string `json:"url"`
}

func toProviderDTO(view ai.ProviderView) aiProviderDTO {
	dto := aiProviderDTO{
		ID:                view.ID,
		Name:              view.Name,
		Kind:              string(view.Kind),
		BaseURL:           view.BaseURL,
		KeyHint:           view.KeyHint,
		PriceMultiplier:   view.PriceMultiplier,
		CatalogProviderID: view.CatalogProviderID,
		Enabled:           view.Enabled,
		Protocols:         protocolStrings(view.Kind.Protocols()),
		RouteCounts:       aiRouteCountsDTO{Total: view.Routes.Total, Active: view.Routes.Active, Suspended: view.Routes.Suspended, Disabled: view.Routes.Disabled},
		SuspendedKinds:    make([]string, len(view.SuspendedKinds)),
		UpstreamIDs:       view.UpstreamIDs,
		Stats:             toStatsDTO(view.Stats),
		LastUsedAt:        view.LastUsed,
		Created:           view.Created,
		Updated:           view.Updated,
	}
	for i, kind := range view.SuspendedKinds {
		dto.SuspendedKinds[i] = string(kind)
	}
	if dto.UpstreamIDs == nil {
		dto.UpstreamIDs = []string{}
	}
	return dto
}

func toProviderDetailDTO(detail ai.ProviderDetail) aiProviderDetailDTO {
	return aiProviderDetailDTO{aiProviderDTO: toProviderDTO(detail.ProviderView), Routes: toRouteDTOs(detail.RouteViews)}
}

func toDiscoveryDTO(discovery ai.Discovery) aiDiscoveryDTO {
	dto := aiDiscoveryDTO{Models: make([]aiDiscoveredModelDTO, len(discovery.Models))}
	if failure := discovery.Failure; failure != nil {
		dto.Error = &aiFailureDetailDTO{Kind: string(failure.Kind), Message: failure.Message, Detail: failure.Detail}
	}
	for i, model := range discovery.Models {
		dto.Models[i] = aiDiscoveredModelDTO{
			UpstreamID:   model.UpstreamID,
			Name:         model.Name,
			CanonicalID:  model.CanonicalID,
			Lab:          model.Lab,
			Protocol:     string(model.Protocol),
			Protocols:    protocolStrings(model.Protocols),
			Vision:       model.Vision,
			Moderation:   model.Moderation,
			ToolCall:     model.ToolCall,
			Reasoning:    model.Reasoning,
			ContextLimit: model.ContextLimit,
			InputPrice:   model.InputPrice,
			OutputPrice:  model.OutputPrice,
			ModelID:      model.ModelID,
			RouteID:      model.RouteID,
		}
	}
	return dto
}

func toResolvedDTOs(models []ai.ResolvedModel) []aiResolvedModelDTO {
	out := make([]aiResolvedModelDTO, len(models))
	for i, model := range models {
		out[i] = aiResolvedModelDTO{UpstreamID: model.UpstreamID, ModelID: model.ModelID, ModelName: model.ModelName, CanonicalID: model.CanonicalID, CatalogName: model.CatalogName}
	}
	return out
}
