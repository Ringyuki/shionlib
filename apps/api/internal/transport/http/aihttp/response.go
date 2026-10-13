package aihttp

import (
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiStatsDTO struct {
	Requests     int     `json:"requests"`
	Failures     int     `json:"failures"`
	FirstTokenMS *int    `json:"first_token_ms"`
	CostUSD      float64 `json:"cost_usd"`
}

type aiModelRefDTO struct {
	ID         int    `json:"id"`
	Key        string `json:"key"`
	Name       string `json:"name"`
	Moderation bool   `json:"moderation"`
}

type aiProviderRefDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind" enum:"compatible,openai,anthropic,google"`
}

type aiFailureDTO struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

type aiPriceTierDTO struct {
	Over      int      `json:"over"`
	Input     float64  `json:"input"`
	Output    float64  `json:"output"`
	CacheRead *float64 `json:"cache_read"`
}

type aiAdjustmentDTO struct {
	ID        int       `json:"id"`
	Kind      string    `json:"kind" enum:"protocol,param,json_mode"`
	Value     string    `json:"value"`
	Previous  *string   `json:"previous"`
	ErrorKind string    `json:"error_kind"`
	RequestID *string   `json:"request_id"`
	Created   time.Time `json:"created"`
}

type aiLastAttemptDTO struct {
	ID           string        `json:"id"`
	OK           bool          `json:"ok"`
	Created      time.Time     `json:"created"`
	FirstTokenMS *int          `json:"first_token_ms"`
	Error        *aiFailureDTO `json:"error"`
}

type aiRouteDTO struct {
	ID              int               `json:"id"`
	Model           aiModelRefDTO     `json:"model"`
	Provider        aiProviderRefDTO  `json:"provider"`
	UpstreamID      string            `json:"upstream_id"`
	Protocol        string            `json:"protocol" enum:"chat,responses,messages,gemini,moderation"`
	PriceManual     bool              `json:"price_manual"`
	InputPrice      float64           `json:"input_price"`
	OutputPrice     float64           `json:"output_price"`
	CacheReadPrice  *float64          `json:"cache_read_price"`
	CacheWritePrice *float64          `json:"cache_write_price"`
	PriceTiers      []aiPriceTierDTO  `json:"price_tiers"`
	DroppedParams   []string          `json:"dropped_params"`
	JSONMode        bool              `json:"json_mode"`
	Priority        int               `json:"priority"`
	Status          string            `json:"status" enum:"active,disabled,suspended"`
	StatusKind      *string           `json:"status_kind"`
	StatusMessage   *string           `json:"status_message"`
	StatusAt        *time.Time        `json:"status_at"`
	Adjustments     []aiAdjustmentDTO `json:"adjustments"`
	Offered         *bool             `json:"offered"`
	Last            *aiLastAttemptDTO `json:"last"`
	Stats           aiStatsDTO        `json:"stats"`
	Created         time.Time         `json:"created"`
	Updated         time.Time         `json:"updated"`
}

func toStatsDTO(stats ai.Stats) aiStatsDTO {
	return aiStatsDTO{Requests: stats.Requests, Failures: stats.Failures, FirstTokenMS: stats.FirstTokenMS, CostUSD: stats.CostUSD}
}

func toModelRefDTO(ref ai.ModelRef) aiModelRefDTO {
	return aiModelRefDTO{ID: ref.ID, Key: ref.Key, Name: ref.Name, Moderation: ref.Moderation}
}

func toOptionalModelRefDTO(ref *ai.ModelRef) *aiModelRefDTO {
	if ref == nil {
		return nil
	}
	dto := toModelRefDTO(*ref)
	return &dto
}

func toProviderRefDTO(ref ai.ProviderRef) aiProviderRefDTO {
	return aiProviderRefDTO{ID: ref.ID, Name: ref.Name, Kind: string(ref.Kind)}
}

func toFailureDTO(failure *ai.Failure) *aiFailureDTO {
	if failure == nil {
		return nil
	}
	return &aiFailureDTO{Kind: string(failure.Kind), Message: failure.Message}
}

func toPriceTiersDTO(tiers []ai.PriceTier) []aiPriceTierDTO {
	if len(tiers) == 0 {
		return nil
	}
	out := make([]aiPriceTierDTO, len(tiers))
	for i, tier := range tiers {
		out[i] = aiPriceTierDTO{Over: tier.Over, Input: tier.Input, Output: tier.Output, CacheRead: tier.CacheRead}
	}
	return out
}

func toRouteDTO(view ai.RouteView) aiRouteDTO {
	route := view.Route
	dto := aiRouteDTO{
		ID:              route.ID,
		Model:           toModelRefDTO(route.Model),
		Provider:        toProviderRefDTO(route.Provider),
		UpstreamID:      route.UpstreamID,
		Protocol:        string(route.Protocol),
		PriceManual:     route.PriceManual,
		InputPrice:      route.Price.Input,
		OutputPrice:     route.Price.Output,
		CacheReadPrice:  route.Price.CacheRead,
		CacheWritePrice: route.Price.CacheWrite,
		PriceTiers:      toPriceTiersDTO(route.Price.Tiers),
		DroppedParams:   route.DroppedParams,
		JSONMode:        route.JSONMode,
		Priority:        route.Priority,
		Status:          string(route.Status),
		StatusMessage:   route.StatusMessage,
		StatusAt:        route.StatusAt,
		Adjustments:     make([]aiAdjustmentDTO, len(route.Adjustments)),
		Offered:         view.Offered,
		Stats:           toStatsDTO(view.Stats),
		Created:         route.Created,
		Updated:         route.Updated,
	}
	if dto.DroppedParams == nil {
		dto.DroppedParams = []string{}
	}
	if route.StatusKind != nil {
		kind := string(*route.StatusKind)
		dto.StatusKind = &kind
	}
	for i, adjustment := range route.Adjustments {
		dto.Adjustments[i] = aiAdjustmentDTO{ID: adjustment.ID, Kind: string(adjustment.Kind), Value: adjustment.Value, Previous: adjustment.Previous, ErrorKind: string(adjustment.ErrorKind), RequestID: int64String(adjustment.RequestID), Created: adjustment.Created}
	}
	if last := view.Last; last != nil {
		dto.Last = &aiLastAttemptDTO{ID: strconv.FormatInt(last.ID, 10), OK: last.OK, Created: last.Created, FirstTokenMS: last.FirstTokenMS}
		if last.ErrorKind != nil {
			dto.Last.Error = &aiFailureDTO{Kind: string(*last.ErrorKind), Message: valueOr(last.ErrorMessage)}
		}
	}
	return dto
}

func toRouteDTOs(views []ai.RouteView) []aiRouteDTO {
	out := make([]aiRouteDTO, len(views))
	for i, view := range views {
		out[i] = toRouteDTO(view)
	}
	return out
}

func int64String(value *int64) *string {
	if value == nil {
		return nil
	}
	text := strconv.FormatInt(*value, 10)
	return &text
}

func valueOr(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func protocolStrings(protocols []ai.Protocol) []string {
	out := make([]string, len(protocols))
	for i, protocol := range protocols {
		out[i] = string(protocol)
	}
	return out
}
