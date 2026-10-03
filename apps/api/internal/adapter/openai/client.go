package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

const (
	maxResponseBytes  = 4 << 20
	maxErrorBodyBytes = 512
	maxReasonLength   = 2550
	maxEvidenceLength = 1000
	schemaName        = "moderationEvent"
	reasoningEffort   = "medium"
)

type Options struct {
	APIKey           string
	BaseURL          string
	ModerationModel  string
	ReviewModel      string
	ScreeningTimeout time.Duration
}

type Client struct {
	http *http.Client
	opts Options
}

func NewClient(httpClient *http.Client, opts Options) *Client {
	opts.BaseURL = strings.TrimRight(opts.BaseURL, "/")
	if opts.ScreeningTimeout <= 0 {
		opts.ScreeningTimeout = 30 * time.Second
	}
	return &Client{http: httpClient, opts: opts}
}

type moderationRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

type moderationResponse struct {
	Results []struct {
		Categories     json.RawMessage `json:"categories"`
		CategoryScores json.RawMessage `json:"category_scores"`
	} `json:"results"`
}

func (c *Client) Screen(ctx context.Context, text string) (moderation.Screening, error) {
	if c.opts.APIKey == "" {
		return moderation.Screening{}, moderation.ErrClassifierDisabled
	}
	ctx, cancel := context.WithTimeout(ctx, c.opts.ScreeningTimeout)
	defer cancel()
	var response moderationResponse
	if err := c.post(ctx, "/moderations", moderationRequest{Model: c.opts.ModerationModel, Input: text}, &response); err != nil {
		return moderation.Screening{}, err
	}
	if len(response.Results) == 0 {
		return moderation.Screening{}, errors.New("openai moderation: response has no results")
	}
	result := response.Results[0]
	var scores map[string]float64
	if err := json.Unmarshal(result.CategoryScores, &scores); err != nil {
		return moderation.Screening{}, fmt.Errorf("openai moderation: decode category scores: %w", err)
	}
	return moderation.Screening{
		Model:          c.opts.ModerationModel,
		Categories:     objectOrEmpty(result.Categories),
		Scores:         result.CategoryScores,
		CategoryScores: scores,
	}, nil
}

type inputMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type   string        `json:"type"`
	Name   string        `json:"name"`
	Strict bool          `json:"strict"`
	Schema verdictSchema `json:"schema"`
}

type responseRequest struct {
	Model string         `json:"model"`
	Input []inputMessage `json:"input"`
	Text  struct {
		Format responseFormat `json:"format"`
	} `json:"text"`
	Reasoning struct {
		Effort string `json:"effort"`
	} `json:"reasoning"`
}

type responseOutput struct {
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type    string `json:"type"`
			Text    string `json:"text"`
			Refusal string `json:"refusal"`
		} `json:"content"`
	} `json:"output"`
}

type parsedVerdict struct {
	Decision    string          `json:"decision"`
	Reason      string          `json:"reason"`
	Evidence    string          `json:"evidence"`
	TopCategory string          `json:"top_category"`
	Categories  json.RawMessage `json:"categories_json"`
}

func (c *Client) Review(ctx context.Context, request moderation.ReviewRequest) (moderation.Verdict, error) {
	if c.opts.APIKey == "" {
		return moderation.Verdict{}, moderation.ErrClassifierDisabled
	}
	body := responseRequest{
		Model: c.opts.ReviewModel,
		Input: []inputMessage{{Role: "system", Content: request.Instructions}, {Role: "user", Content: request.Input}},
	}
	body.Text.Format = responseFormat{Type: "json_schema", Name: schemaName, Strict: true, Schema: newVerdictSchema()}
	body.Reasoning.Effort = reasoningEffort
	var response responseOutput
	if err := c.post(ctx, "/responses", body, &response); err != nil {
		return moderation.Verdict{}, err
	}
	text, err := outputText(response)
	if err != nil {
		return moderation.Verdict{}, err
	}
	var parsed parsedVerdict
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return moderation.Verdict{}, fmt.Errorf("openai review: decode structured output: %w", err)
	}
	decision := moderation.Decision(parsed.Decision)
	if decision != moderation.DecisionAllow && decision != moderation.DecisionBlock {
		return moderation.Verdict{}, fmt.Errorf("openai review: unexpected decision %q", parsed.Decision)
	}
	category := moderation.Category(parsed.TopCategory)
	if !category.Valid() {
		return moderation.Verdict{}, fmt.Errorf("openai review: unexpected category %q", parsed.TopCategory)
	}
	return moderation.Verdict{
		Model:       c.opts.ReviewModel,
		Decision:    decision,
		Reason:      truncate(parsed.Reason, maxReasonLength),
		Evidence:    truncate(parsed.Evidence, maxEvidenceLength),
		TopCategory: category,
		Categories:  objectOrEmpty(parsed.Categories),
	}, nil
}

func outputText(response responseOutput) (string, error) {
	for _, item := range response.Output {
		if item.Type != "message" {
			continue
		}
		for _, content := range item.Content {
			switch content.Type {
			case "output_text":
				return content.Text, nil
			case "refusal":
				return "", fmt.Errorf("openai review: model refused: %s", truncate(content.Refusal, maxErrorBodyBytes))
			}
		}
	}
	return "", errors.New("openai review: response has no output text")
}

func (c *Client) post(ctx context.Context, path string, body, target any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("openai %s: encode request: %w", path, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.opts.BaseURL+path, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("openai %s: build request: %w", path, err)
	}
	req.Header.Set("Authorization", "Bearer "+c.opts.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("openai %s: %w", path, err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return fmt.Errorf("openai %s: read response: %w", path, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("openai %s: status %d: %s", path, resp.StatusCode, truncate(string(data), maxErrorBodyBytes))
	}
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("openai %s: decode response: %w", path, err)
	}
	return nil
}

func objectOrEmpty(raw json.RawMessage) json.RawMessage {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '{' || !json.Valid(trimmed) {
		return json.RawMessage(`{}`)
	}
	return json.RawMessage(slices.Clone(trimmed))
}

func truncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
