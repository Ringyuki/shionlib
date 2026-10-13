package translatorhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

type adminTranslatorItemDTO struct {
	ID             int        `json:"id"`
	Name           string     `json:"name"`
	Aliases        []string   `json:"aliases"`
	Homepage       *string    `json:"homepage"`
	WorksCount     int        `json:"works_count"`
	ResourcesCount int        `json:"resources_count"`
	LatestCredit   *time.Time `json:"latest_credit" doc:"When the latest resource crediting the translator was published; null without credits"`
}

type adminTranslatorClusterDTO struct {
	Translators []adminTranslatorItemDTO `json:"translators"`
}

func toAdminTranslatorItemDTO(entry translator.AdminEntry) adminTranslatorItemDTO {
	return adminTranslatorItemDTO{
		ID:             entry.ID,
		Name:           entry.Name,
		Aliases:        nonNil(entry.Aliases),
		Homepage:       entry.Homepage,
		WorksCount:     entry.WorksCount,
		ResourcesCount: entry.ResourcesCount,
		LatestCredit:   entry.LatestCredit,
	}
}

func toAdminTranslatorClusterDTO(entries []translator.AdminEntry) adminTranslatorClusterDTO {
	items := make([]adminTranslatorItemDTO, len(entries))
	for i, entry := range entries {
		items[i] = toAdminTranslatorItemDTO(entry)
	}
	return adminTranslatorClusterDTO{Translators: items}
}
