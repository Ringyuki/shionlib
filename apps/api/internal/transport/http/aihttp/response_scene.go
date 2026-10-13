package aihttp

import "github.com/Ringyuki/shionlib/apps/api/internal/ai"

type aiSceneDTO struct {
	Key             string         `json:"key"`
	Label           string         `json:"label"`
	Output          string         `json:"output" enum:"object,text,moderation"`
	Model           *aiModelRefDTO `json:"model"`
	Effective       *aiModelRefDTO `json:"effective"`
	Temperature     *float64       `json:"temperature"`
	MaxOutputTokens *int           `json:"max_output_tokens"`
	TimeoutMS       *int           `json:"timeout_ms"`
	Problem         *string        `json:"problem" enum:"no_model,no_route,wrong_output"`
	Stats           aiStatsDTO     `json:"stats"`
}

func toSceneDTO(scene ai.Scene) aiSceneDTO {
	dto := aiSceneDTO{
		Key:             scene.Key,
		Label:           scene.Label,
		Output:          string(scene.Output),
		Model:           toOptionalModelRefDTO(scene.Model),
		Effective:       toOptionalModelRefDTO(scene.Effective),
		Temperature:     scene.Temperature,
		MaxOutputTokens: scene.MaxOutputTokens,
		Stats:           toStatsDTO(scene.Stats),
	}
	if scene.Timeout != nil {
		ms := int(scene.Timeout.Milliseconds())
		dto.TimeoutMS = &ms
	}
	if scene.Problem != nil {
		problem := string(*scene.Problem)
		dto.Problem = &problem
	}
	return dto
}
