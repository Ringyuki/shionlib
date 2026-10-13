package translatorhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type translatorListItemDTO struct {
	ID         int      `json:"id"`
	Name       string   `json:"name"`
	Aliases    []string `json:"aliases"`
	WorksCount int      `json:"works_count"`
}

type translatorDetailDTO struct {
	ID         int      `json:"id"`
	Name       string   `json:"name"`
	Aliases    []string `json:"aliases"`
	Homepage   *string  `json:"homepage"`
	WorksCount int      `json:"works_count"`
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func toTranslatorListItemDTO(summary translator.Summary) translatorListItemDTO {
	return translatorListItemDTO{ID: summary.ID, Name: summary.Name, Aliases: nonNil(summary.Aliases), WorksCount: summary.WorksCount}
}

func toTranslatorDetailDTO(detail translator.Detail) translatorDetailDTO {
	return translatorDetailDTO{ID: detail.ID, Name: detail.Name, Aliases: nonNil(detail.Aliases), Homepage: detail.Homepage, WorksCount: detail.WorksCount}
}
