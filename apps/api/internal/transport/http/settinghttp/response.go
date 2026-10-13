package settinghttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type settingDTO struct {
	Name        string            `json:"name"`
	Group       string            `json:"group"`
	Kind        string            `json:"kind" enum:"int,bytes,float,duration,flag,text,secret" doc:"Durations are in seconds, bytes in bytes. A secret is never returned: its value is an empty string, and overridden tells whether one is set"`
	Label       string            `json:"label"`
	Description string            `json:"description"`
	Value       json.RawMessage   `json:"value"`
	Default     json.RawMessage   `json:"default"`
	Min         json.RawMessage   `json:"min,omitempty"`
	Max         json.RawMessage   `json:"max,omitempty"`
	MaxLength   int               `json:"max_length,omitempty"`
	Overridden  bool              `json:"overridden" doc:"False when the default applies"`
	LastChange  *settingChangeDTO `json:"last_change"`
}

type settingEditorDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type settingChangeDTO struct {
	ID       int               `json:"id"`
	Previous json.RawMessage   `json:"previous" doc:"Null when the default applied before the change"`
	Value    json.RawMessage   `json:"value" doc:"Null when the change restored the default"`
	Editor   *settingEditorDTO `json:"editor"`
	Created  time.Time         `json:"created"`
}

type publicSettingsDTO struct {
	AllowRegister  bool `json:"allow_register"`
	SponsorEnabled bool `json:"sponsor_enabled"`
}

func toSettingDTO(entry setting.Entry) settingDTO {
	dto := settingDTO{
		Name:        entry.Name,
		Group:       entry.Group(),
		Kind:        string(entry.Kind),
		Label:       entry.Label,
		Description: entry.Description,
		Value:       entry.Value,
		Default:     entry.Default,
		Min:         entry.Min,
		Max:         entry.Max,
		MaxLength:   entry.MaxLength,
		Overridden:  entry.Overridden,
	}
	if entry.LastChange != nil {
		change := toSettingChangeDTO(*entry.LastChange)
		dto.LastChange = &change
	}
	return dto
}

func toSettingChangeDTO(change setting.Change) settingChangeDTO {
	dto := settingChangeDTO{ID: change.ID, Previous: change.Previous, Value: change.Value, Created: change.Created}
	if change.Editor != nil {
		dto.Editor = &settingEditorDTO{ID: change.Editor.ID, Name: change.Editor.Name}
	}
	return dto
}

func toPublicSettingsDTO(source setting.Source) publicSettingsDTO {
	return publicSettingsDTO{
		AllowRegister:  user.AllowRegister.Read(source),
		SponsorEnabled: sponsor.Enabled.Read(source),
	}
}
