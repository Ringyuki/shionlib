package developerhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
)

type adminDeveloperItemDTO struct {
	ID         int       `json:"id"`
	Name       string    `json:"name"`
	Logo       *string   `json:"logo,omitempty"`
	GamesCount int       `json:"gamesCount"`
	Created    time.Time `json:"created"`
	Updated    time.Time `json:"updated"`
}

func toAdminDeveloperItemDTO(entry developer.AdminEntry) adminDeveloperItemDTO {
	return adminDeveloperItemDTO{
		ID:         entry.ID,
		Name:       entry.Name,
		Logo:       entry.Logo,
		GamesCount: entry.GamesCount,
		Created:    entry.Created,
		Updated:    entry.Updated,
	}
}
