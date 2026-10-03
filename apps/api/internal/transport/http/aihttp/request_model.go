package aihttp

import (
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiModelRouteInput struct {
	ProviderID int    `json:"provider_id" minimum:"1"`
	UpstreamID string `json:"upstream_id" minLength:"1" maxLength:"200"`
	Protocol   string `json:"protocol" enum:"chat,responses,messages,gemini,moderation"`
}

type aiModelCreateInput struct {
	Body struct {
		CanonicalID string              `json:"canonical_id" minLength:"1" maxLength:"200"`
		Name        string              `json:"name" minLength:"1" maxLength:"100"`
		Description *string             `json:"description,omitempty" maxLength:"500"`
		Routes      []aiModelRouteInput `json:"routes" maxItems:"20"`
	}
}

func (in *aiModelCreateInput) model() ai.ModelInput {
	model := ai.ModelInput{CanonicalID: in.Body.CanonicalID, Name: strings.TrimSpace(in.Body.Name), Description: in.Body.Description, Routes: make([]ai.RouteSource, len(in.Body.Routes))}
	for i, route := range in.Body.Routes {
		model.Routes[i] = ai.RouteSource{ProviderID: route.ProviderID, UpstreamID: strings.TrimSpace(route.UpstreamID), Protocol: ai.Protocol(route.Protocol)}
	}
	return model
}

type aiModelUpdateInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Name        *string             `json:"name,omitempty" minLength:"1" maxLength:"100"`
		Description aiNullableTextInput `json:"description,omitempty" doc:"null clears the value"`
		CanonicalID aiNullableTextInput `json:"canonical_id,omitempty" doc:"null unlinks the catalog entry"`
		Vision      *bool               `json:"vision,omitempty"`
		Enabled     *bool               `json:"enabled,omitempty"`
		IsDefault   *bool               `json:"is_default,omitempty"`
	}
}

func (in *aiModelUpdateInput) update() ai.ModelUpdate {
	update := ai.ModelUpdate{Description: in.Body.Description.change(), CanonicalID: in.Body.CanonicalID.change(), Vision: in.Body.Vision, Enabled: in.Body.Enabled, IsDefault: in.Body.IsDefault}
	if in.Body.Name != nil {
		name := strings.TrimSpace(*in.Body.Name)
		update.Name = &name
	}
	return update
}

type aiModelReorderInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		IDs []int `json:"ids" maxItems:"50"`
	}
}

type aiModelAddRouteInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		ProviderID  int      `json:"provider_id" minimum:"1"`
		UpstreamID  string   `json:"upstream_id" minLength:"1" maxLength:"200"`
		Protocol    string   `json:"protocol" enum:"chat,responses,messages,gemini,moderation"`
		PriceManual *bool    `json:"price_manual,omitempty"`
		InputPrice  *float64 `json:"input_price,omitempty" minimum:"0"`
		OutputPrice *float64 `json:"output_price,omitempty" minimum:"0"`
	}
}

func (in *aiModelAddRouteInput) source() ai.RouteSource {
	return ai.RouteSource{
		ProviderID:  in.Body.ProviderID,
		UpstreamID:  strings.TrimSpace(in.Body.UpstreamID),
		Protocol:    ai.Protocol(in.Body.Protocol),
		PriceManual: in.Body.PriceManual != nil && *in.Body.PriceManual,
		InputPrice:  in.Body.InputPrice,
		OutputPrice: in.Body.OutputPrice,
	}
}
