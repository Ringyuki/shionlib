package aihttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiModelSceneDTO struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Role  string `json:"role" enum:"primary,default"`
}

type aiModelDTO struct {
	ID           int               `json:"id"`
	Key          string            `json:"key"`
	Name         string            `json:"name"`
	Description  *string           `json:"description"`
	CanonicalID  *string           `json:"canonical_id"`
	Vision       bool              `json:"vision"`
	Moderation   bool              `json:"moderation"`
	Temperature  bool              `json:"temperature"`
	ToolCall     bool              `json:"tool_call"`
	Reasoning    bool              `json:"reasoning"`
	ContextLimit *int              `json:"context_limit"`
	OutputLimit  *int              `json:"output_limit"`
	IsDefault    bool              `json:"is_default"`
	Enabled      bool              `json:"enabled"`
	Routes       []aiRouteDTO      `json:"routes"`
	Scenes       []aiModelSceneDTO `json:"scenes"`
	Stats        aiStatsDTO        `json:"stats"`
	Created      time.Time         `json:"created"`
	Updated      time.Time         `json:"updated"`
}

func toModelDTO(view ai.ModelView) aiModelDTO {
	dto := aiModelDTO{
		ID:           view.ID,
		Key:          view.Key,
		Name:         view.Name,
		Description:  view.Description,
		CanonicalID:  view.CanonicalID,
		Vision:       view.Vision,
		Moderation:   view.Moderation,
		Temperature:  view.Temperature,
		ToolCall:     view.ToolCall,
		Reasoning:    view.Reasoning,
		ContextLimit: view.ContextLimit,
		OutputLimit:  view.OutputLimit,
		IsDefault:    view.IsDefault,
		Enabled:      view.Enabled,
		Routes:       toRouteDTOs(view.RouteViews),
		Scenes:       make([]aiModelSceneDTO, len(view.Scenes)),
		Stats:        toStatsDTO(view.Stats),
		Created:      view.Created,
		Updated:      view.Updated,
	}
	for i, scene := range view.Scenes {
		dto.Scenes[i] = aiModelSceneDTO{Key: scene.Key, Label: scene.Label, Role: string(scene.Role)}
	}
	return dto
}
