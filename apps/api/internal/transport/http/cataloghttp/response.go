package cataloghttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type catalogHitDTO struct {
	ExternalID string  `json:"external_id"`
	Title      string  `json:"title"`
	Subtitle   *string `json:"subtitle"`
	Developer  *string `json:"developer"`
	Cover      *string `json:"cover"`
}

func toCatalogHitDTO(hit catalog.SearchHit) catalogHitDTO {
	return catalogHitDTO{ExternalID: hit.ExternalID, Title: hit.Title, Subtitle: hit.Subtitle, Developer: hit.Developer, Cover: hit.CoverURL}
}

type catalogImportedDTO struct {
	ID int `json:"id"`
}
