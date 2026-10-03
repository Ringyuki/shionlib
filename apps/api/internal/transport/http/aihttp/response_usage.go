package aihttp

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiOverviewDTO struct {
	Current  aiStatsDTO `json:"current"`
	Previous aiStatsDTO `json:"previous"`
}

type aiSeriesBucketDTO struct {
	At           time.Time `json:"at"`
	Requests     int       `json:"requests"`
	Failures     int       `json:"failures"`
	CostUSD      float64   `json:"cost_usd"`
	FirstTokenMS *int      `json:"first_token_ms"`
}

type aiModelCostDTO struct {
	ModelID *int      `json:"model_id"`
	Label   *string   `json:"label"`
	Costs   []float64 `json:"costs"`
}

type aiCostSeriesDTO struct {
	BucketMS int64               `json:"bucket_ms"`
	Buckets  []aiSeriesBucketDTO `json:"buckets"`
	Models   []aiModelCostDTO    `json:"models"`
}

type aiBreakdownRowDTO struct {
	Key           string   `json:"key"`
	Label         string   `json:"label"`
	Routes        []string `json:"routes"`
	Requests      int      `json:"requests"`
	Failures      int      `json:"failures"`
	FirstTokenMS  *int     `json:"first_token_ms"`
	CostUSD       float64  `json:"cost_usd"`
	DurationP95MS *int     `json:"duration_p95_ms"`
	InputTokens   int      `json:"input_tokens"`
	OutputTokens  int      `json:"output_tokens"`
}

type aiSummaryDTO struct {
	Stats    aiStatsDTO          `json:"stats"`
	BucketMS int64               `json:"bucket_ms"`
	Buckets  []aiSeriesBucketDTO `json:"buckets"`
}

type aiRequestDTO struct {
	ID              string            `json:"id"`
	CallID          string            `json:"call_id"`
	Source          string            `json:"source" enum:"scene,check,playground"`
	Scene           *string           `json:"scene"`
	Model           *aiModelRefDTO    `json:"model"`
	RouteID         *int              `json:"route_id"`
	Provider        *aiProviderRefDTO `json:"provider"`
	UpstreamID      string            `json:"upstream_id"`
	Protocol        string            `json:"protocol"`
	OK              bool              `json:"ok"`
	ErrorKind       *string           `json:"error_kind"`
	ErrorMessage    *string           `json:"error_message"`
	Adaptation      *string           `json:"adaptation"`
	FirstTokenMS    *int              `json:"first_token_ms"`
	DurationMS      int               `json:"duration_ms"`
	InputTokens     int               `json:"input_tokens"`
	OutputTokens    int               `json:"output_tokens"`
	CacheReadTokens int               `json:"cache_read_tokens"`
	CostUSD         float64           `json:"cost_usd"`
	Created         time.Time         `json:"created"`
}

type aiMessageDTO struct {
	Role    string `json:"role" enum:"user,assistant"`
	Content string `json:"content"`
}

type aiPayloadDTO struct {
	System   string          `json:"system"`
	Messages []aiMessageDTO  `json:"messages"`
	Schema   json.RawMessage `json:"schema"`
	Output   *string         `json:"output"`
}

type aiRequestDetailDTO struct {
	aiRequestDTO
	ErrorDetail      *string        `json:"error_detail"`
	FinishReason     *string        `json:"finish_reason"`
	CacheWriteTokens int            `json:"cache_write_tokens"`
	ReasoningTokens  int            `json:"reasoning_tokens"`
	Payload          *aiPayloadDTO  `json:"payload"`
	Attempts         []aiRequestDTO `json:"attempts"`
}

func toSeriesDTO(buckets []ai.SeriesBucket) []aiSeriesBucketDTO {
	out := make([]aiSeriesBucketDTO, len(buckets))
	for i, bucket := range buckets {
		out[i] = aiSeriesBucketDTO{At: bucket.At, Requests: bucket.Requests, Failures: bucket.Failures, CostUSD: bucket.CostUSD, FirstTokenMS: bucket.FirstTokenMS}
	}
	return out
}

func toCostSeriesDTO(series ai.CostSeries) aiCostSeriesDTO {
	dto := aiCostSeriesDTO{BucketMS: series.Bucket.Milliseconds(), Buckets: toSeriesDTO(series.Buckets), Models: make([]aiModelCostDTO, len(series.Models))}
	for i, model := range series.Models {
		dto.Models[i] = aiModelCostDTO{ModelID: model.ModelID, Label: model.Label, Costs: model.Costs}
	}
	return dto
}

func toBreakdownDTOs(rows []ai.BreakdownRow) []aiBreakdownRowDTO {
	out := make([]aiBreakdownRowDTO, len(rows))
	for i, row := range rows {
		out[i] = aiBreakdownRowDTO{
			Key:           row.Key,
			Label:         row.Label,
			Routes:        row.Routes,
			Requests:      row.Stats.Requests,
			Failures:      row.Stats.Failures,
			FirstTokenMS:  row.Stats.FirstTokenMS,
			CostUSD:       row.Stats.CostUSD,
			DurationP95MS: row.DurationP95,
			InputTokens:   row.InputTokens,
			OutputTokens:  row.OutputTokens,
		}
	}
	return out
}

func toRequestDTO(request ai.Request) aiRequestDTO {
	dto := aiRequestDTO{
		ID:              strconv.FormatInt(request.ID, 10),
		CallID:          request.CallID,
		Source:          string(request.Source),
		Scene:           request.Scene,
		Model:           toOptionalModelRefDTO(request.Model),
		RouteID:         request.RouteID,
		UpstreamID:      request.UpstreamID,
		Protocol:        string(request.Protocol),
		OK:              request.OK,
		ErrorMessage:    request.ErrorMessage,
		Adaptation:      request.Adaptation,
		FirstTokenMS:    request.FirstTokenMS,
		DurationMS:      request.DurationMS,
		InputTokens:     request.Usage.InputTokens,
		OutputTokens:    request.Usage.OutputTokens,
		CacheReadTokens: request.Usage.CacheReadTokens,
		CostUSD:         request.CostUSD,
		Created:         request.Created,
	}
	if request.Provider != nil {
		provider := toProviderRefDTO(*request.Provider)
		dto.Provider = &provider
	}
	if request.ErrorKind != nil {
		kind := string(*request.ErrorKind)
		dto.ErrorKind = &kind
	}
	return dto
}

func toRequestDTOs(requests []ai.Request) []aiRequestDTO {
	out := make([]aiRequestDTO, len(requests))
	for i, request := range requests {
		out[i] = toRequestDTO(request)
	}
	return out
}

func toRequestDetailDTO(detail ai.RequestDetail) aiRequestDetailDTO {
	dto := aiRequestDetailDTO{
		aiRequestDTO:     toRequestDTO(detail.Request),
		ErrorDetail:      detail.ErrorDetail,
		FinishReason:     detail.FinishReason,
		CacheWriteTokens: detail.Usage.CacheWriteTokens,
		ReasoningTokens:  detail.Usage.ReasoningTokens,
		Attempts:         toRequestDTOs(detail.Attempts),
	}
	if payload := detail.Payload; payload != nil {
		dto.Payload = &aiPayloadDTO{System: payload.System, Messages: make([]aiMessageDTO, len(payload.Messages)), Output: payload.Output}
		if len(payload.Schema) > 0 {
			dto.Payload.Schema = json.RawMessage(payload.Schema)
		}
		for i, message := range payload.Messages {
			dto.Payload.Messages[i] = aiMessageDTO{Role: string(message.Role), Content: message.Content}
		}
	}
	return dto
}
