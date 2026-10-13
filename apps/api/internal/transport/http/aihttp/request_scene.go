package aihttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiSceneUpdateInput struct {
	Key  string `path:"key" minLength:"1" maxLength:"64"`
	Body struct {
		ModelID         *int     `json:"model_id,omitempty" minimum:"1" doc:"Omit to follow the default model"`
		Temperature     *float64 `json:"temperature,omitempty" minimum:"0" maximum:"2"`
		MaxOutputTokens *int     `json:"max_output_tokens,omitempty" minimum:"1" maximum:"1000000"`
		TimeoutMS       *int     `json:"timeout_ms,omitempty" minimum:"1000" maximum:"600000" doc:"Idle timeout between streamed chunks"`
	}
}

func (in *aiSceneUpdateInput) settings() ai.SceneSettings {
	settings := ai.SceneSettings{ModelID: in.Body.ModelID, Temperature: in.Body.Temperature, MaxOutputTokens: in.Body.MaxOutputTokens}
	if in.Body.TimeoutMS != nil {
		timeout := time.Duration(*in.Body.TimeoutMS) * time.Millisecond
		settings.Timeout = &timeout
	}
	return settings
}
