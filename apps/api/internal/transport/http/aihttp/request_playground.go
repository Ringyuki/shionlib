package aihttp

import (
	"encoding/json"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiPlaygroundTargetInput struct {
	Kind string `json:"kind" enum:"scene,model,route"`
	ID   string `json:"id" minLength:"1" maxLength:"64"`
}

type aiPlaygroundMessageInput struct {
	Role    string `json:"role" enum:"user,assistant"`
	Content string `json:"content" minLength:"1" maxLength:"200000"`
}

type aiPlaygroundInput struct {
	Body struct {
		Targets         []aiPlaygroundTargetInput  `json:"targets" minItems:"1" maxItems:"3"`
		System          *string                    `json:"system,omitempty" maxLength:"50000"`
		Messages        []aiPlaygroundMessageInput `json:"messages" minItems:"1" maxItems:"50"`
		Temperature     *float64                   `json:"temperature,omitempty" minimum:"0" maximum:"2"`
		MaxOutputTokens *int                       `json:"max_output_tokens,omitempty" minimum:"1" maximum:"200000"`
		Schema          json.RawMessage            `json:"schema,omitempty" doc:"JSON schema of an object; requests structured output when present"`
	}
}

func (in *aiPlaygroundInput) run() ai.PlaygroundRun {
	run := ai.PlaygroundRun{Targets: make([]ai.PlaygroundTarget, len(in.Body.Targets)), Temperature: in.Body.Temperature, MaxOutputTokens: in.Body.MaxOutputTokens, Schema: in.Body.Schema}
	for i, target := range in.Body.Targets {
		run.Targets[i] = ai.PlaygroundTarget{Kind: ai.PlaygroundTargetKind(target.Kind), ID: target.ID}
	}
	if in.Body.System != nil {
		run.Prompt.System = *in.Body.System
	}
	run.Prompt.Messages = make([]ai.Message, len(in.Body.Messages))
	for i, message := range in.Body.Messages {
		run.Prompt.Messages[i] = ai.Message{Role: ai.Role(message.Role), Content: message.Content}
	}
	return run
}
