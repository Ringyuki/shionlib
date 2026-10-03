package aihttp

import (
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiProviderCreateInput struct {
	Body struct {
		Kind              string   `json:"kind" enum:"compatible,openai,anthropic,google"`
		Name              string   `json:"name" minLength:"1" maxLength:"60"`
		BaseURL           *string  `json:"base_url,omitempty" maxLength:"500"`
		APIKey            string   `json:"api_key" minLength:"1" maxLength:"1000"`
		PriceMultiplier   *float64 `json:"price_multiplier,omitempty" minimum:"0" maximum:"100"`
		CatalogProviderID *string  `json:"catalog_provider_id,omitempty" maxLength:"100"`
	}
}

func (in *aiProviderCreateInput) provider() ai.ProviderInput {
	return ai.ProviderInput{
		Name:              strings.TrimSpace(in.Body.Name),
		Kind:              ai.ProviderKind(in.Body.Kind),
		BaseURL:           in.Body.BaseURL,
		APIKey:            in.Body.APIKey,
		PriceMultiplier:   in.Body.PriceMultiplier,
		CatalogProviderID: in.Body.CatalogProviderID,
	}
}

type aiProviderUpdateInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Kind              *string             `json:"kind,omitempty" enum:"compatible,openai,anthropic,google"`
		Name              *string             `json:"name,omitempty" minLength:"1" maxLength:"60"`
		BaseURL           aiNullableTextInput `json:"base_url,omitempty" doc:"null clears the value"`
		APIKey            *string             `json:"api_key,omitempty" minLength:"1" maxLength:"1000"`
		PriceMultiplier   *float64            `json:"price_multiplier,omitempty" minimum:"0" maximum:"100"`
		CatalogProviderID aiNullableTextInput `json:"catalog_provider_id,omitempty" doc:"null clears the value"`
		Enabled           *bool               `json:"enabled,omitempty"`
	}
}

func (in *aiProviderUpdateInput) update() ai.ProviderUpdate {
	update := ai.ProviderUpdate{
		APIKey:            in.Body.APIKey,
		PriceMultiplier:   in.Body.PriceMultiplier,
		BaseURL:           in.Body.BaseURL.change(),
		CatalogProviderID: in.Body.CatalogProviderID.change(),
		Enabled:           in.Body.Enabled,
	}
	if in.Body.Kind != nil {
		kind := ai.ProviderKind(*in.Body.Kind)
		update.Kind = &kind
	}
	if in.Body.Name != nil {
		name := strings.TrimSpace(*in.Body.Name)
		update.Name = &name
	}
	return update
}

type aiEndpointInput struct {
	Kind    string `query:"kind" required:"true" enum:"compatible,openai,anthropic,google"`
	BaseURL string `query:"base_url" maxLength:"500"`
}

type aiRouteItemInput struct {
	UpstreamID string `json:"upstream_id" minLength:"1" maxLength:"200"`
	Protocol   string `json:"protocol" enum:"chat,responses,messages,gemini,moderation"`
}

type aiAddRoutesInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Items []aiRouteItemInput `json:"items" minItems:"1" maxItems:"500"`
	}
}

func (in *aiAddRoutesInput) items() []ai.RouteItem {
	items := make([]ai.RouteItem, len(in.Body.Items))
	for i, item := range in.Body.Items {
		items[i] = ai.RouteItem{UpstreamID: strings.TrimSpace(item.UpstreamID), Protocol: ai.Protocol(item.Protocol)}
	}
	return items
}

type aiResolveInput struct {
	ID  int    `path:"id" minimum:"1"`
	IDs string `query:"ids" required:"true" minLength:"1" maxLength:"20000" doc:"Comma-separated upstream model ids"`
}

func (in *aiResolveInput) upstreamIDs() []string {
	var ids []string
	for _, id := range strings.Split(in.IDs, ",") {
		if trimmed := strings.TrimSpace(id); trimmed != "" && len(ids) < 100 {
			ids = append(ids, trimmed)
		}
	}
	return ids
}
