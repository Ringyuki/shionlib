package aimoderation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

const (
	ScreenScene       = "moderation_screen"
	ReviewScene       = "moderation_review"
	schemaName        = "moderationEvent"
	maxReasonLength   = 2550
	maxEvidenceLength = 1000
)

var Scenes = []ai.SceneDefinition{
	{Key: ScreenScene, Label: "内容审核初筛", Output: ai.OutputModeration},
	{Key: ReviewScene, Label: "内容审核复审", Output: ai.OutputObject},
}

type Gateway interface {
	Moderate(ctx context.Context, scene string, request ai.ModerationRequest) (ai.ModerationResult, error)
	Object(ctx context.Context, scene string, request ai.ObjectRequest) (ai.ObjectResult, error)
}

type Classifier struct {
	gateway Gateway
	schema  json.RawMessage
}

func NewClassifier(gateway Gateway) (*Classifier, error) {
	schema, err := json.Marshal(newVerdictSchema())
	if err != nil {
		return nil, fmt.Errorf("encode moderation verdict schema: %w", err)
	}
	return &Classifier{gateway: gateway, schema: schema}, nil
}

func (c *Classifier) Screen(ctx context.Context, text string) (moderation.Screening, error) {
	result, err := c.gateway.Moderate(ctx, ScreenScene, ai.ModerationRequest{Input: text})
	if errors.Is(err, ai.ErrSceneNotConfigured) {
		return moderation.Screening{}, moderation.ErrClassifierDisabled
	}
	if err != nil {
		return moderation.Screening{}, fmt.Errorf("screen with %s: %w", ScreenScene, err)
	}
	var scores map[string]float64
	if err := json.Unmarshal(result.Scores, &scores); err != nil {
		return moderation.Screening{}, fmt.Errorf("decode moderation scores: %w", err)
	}
	return moderation.Screening{
		Model:          result.Model,
		Categories:     objectOrEmpty(result.Categories),
		Scores:         objectOrEmpty(result.Scores),
		CategoryScores: scores,
	}, nil
}

func (c *Classifier) Review(ctx context.Context, request moderation.ReviewRequest) (moderation.Verdict, error) {
	result, err := c.gateway.Object(ctx, ReviewScene, ai.ObjectRequest{
		Prompt:     ai.UserPrompt(request.Instructions, request.Input),
		Schema:     c.schema,
		SchemaName: schemaName,
	})
	if errors.Is(err, ai.ErrSceneNotConfigured) {
		return moderation.Verdict{}, moderation.ErrClassifierDisabled
	}
	if err != nil {
		return moderation.Verdict{}, fmt.Errorf("review with %s: %w", ReviewScene, err)
	}
	var parsed verdictRecord
	if err := json.Unmarshal(result.Output, &parsed); err != nil {
		return moderation.Verdict{}, fmt.Errorf("decode moderation verdict: %w", err)
	}
	decision := moderation.Decision(parsed.Decision)
	if decision != moderation.DecisionAllow && decision != moderation.DecisionBlock {
		return moderation.Verdict{}, fmt.Errorf("moderation verdict has unexpected decision %q", parsed.Decision)
	}
	category := moderation.Category(parsed.TopCategory)
	if !category.Valid() {
		return moderation.Verdict{}, fmt.Errorf("moderation verdict has unexpected category %q", parsed.TopCategory)
	}
	return moderation.Verdict{
		Model:       result.Model,
		Decision:    decision,
		Reason:      truncate(parsed.Reason, maxReasonLength),
		Evidence:    truncate(parsed.Evidence, maxEvidenceLength),
		TopCategory: category,
		Categories:  objectOrEmpty(parsed.Categories),
	}, nil
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
