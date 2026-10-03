package aihttp

import (
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiRouteUpdateInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		UpstreamID  *string  `json:"upstream_id,omitempty" minLength:"1" maxLength:"200"`
		Protocol    *string  `json:"protocol,omitempty" enum:"chat,responses,messages,gemini,moderation"`
		PriceManual *bool    `json:"price_manual,omitempty"`
		InputPrice  *float64 `json:"input_price,omitempty" minimum:"0"`
		OutputPrice *float64 `json:"output_price,omitempty" minimum:"0"`
		Status      *string  `json:"status,omitempty" enum:"active,disabled"`
	}
}

func (in *aiRouteUpdateInput) update() ai.RouteUpdate {
	update := ai.RouteUpdate{Protocol: optionalProtocol(in.Body.Protocol), PriceManual: in.Body.PriceManual, InputPrice: in.Body.InputPrice, OutputPrice: in.Body.OutputPrice}
	if in.Body.UpstreamID != nil {
		upstreamID := strings.TrimSpace(*in.Body.UpstreamID)
		update.UpstreamID = &upstreamID
	}
	if in.Body.Status != nil {
		status := ai.RouteStatus(*in.Body.Status)
		update.Status = &status
	}
	return update
}

type aiAdjustmentPathInput struct {
	ID           int `path:"id" minimum:"1"`
	AdjustmentID int `path:"adjustment_id" minimum:"1"`
}

type aiRouteBatchInput struct {
	Body struct {
		IDs    []int  `json:"ids" minItems:"1" maxItems:"500"`
		Action string `json:"action" enum:"enable,disable,delete"`
	}
}
