package aiwalkthrough

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const (
	FormatScene = "walkthrough_format"
	schemaName  = "walkthroughFormat"
)

var Scenes = []ai.SceneDefinition{
	{Key: FormatScene, Label: "整理攻略格式", Output: ai.OutputObject},
}

type Gateway interface {
	SceneTarget(ctx context.Context, key string, source ai.Source) (ai.Target, error)
	Object(ctx context.Context, scene string, request ai.ObjectRequest) (ai.ObjectResult, error)
}

type Formatter struct {
	gateway Gateway
	schema  json.RawMessage
}

func NewFormatter(gateway Gateway) (*Formatter, error) {
	schema, err := json.Marshal(newFormatSchema())
	if err != nil {
		return nil, fmt.Errorf("encode walkthrough format schema: %w", err)
	}
	return &Formatter{gateway: gateway, schema: schema}, nil
}

func (f *Formatter) Ready(ctx context.Context) (bool, error) {
	_, err := f.gateway.SceneTarget(ctx, FormatScene, ai.SourceScene)
	if errors.Is(err, ai.ErrSceneNotConfigured) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("look up %s: %w", FormatScene, err)
	}
	return true, nil
}

func (f *Formatter) Format(ctx context.Context, request walkthrough.FormatRequest) (walkthrough.Formatted, error) {
	result, err := f.gateway.Object(ctx, FormatScene, ai.ObjectRequest{
		Prompt:     ai.UserPrompt(instructions, input(request)),
		Schema:     f.schema,
		SchemaName: schemaName,
	})
	if err != nil {
		return walkthrough.Formatted{}, fmt.Errorf("format with %s: %w", FormatScene, err)
	}
	var parsed formattedRecord
	if err := json.Unmarshal(result.Output, &parsed); err != nil {
		return walkthrough.Formatted{}, fmt.Errorf("decode formatted walkthrough: %w", err)
	}
	return parsed.formatted(), nil
}
