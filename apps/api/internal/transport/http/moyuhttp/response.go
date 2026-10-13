package moyuhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type moyuPublisherDTO struct {
	Name   string  `json:"name"`
	Avatar *string `json:"avatar" doc:"Address of the publisher's avatar on the other site; null without one"`
}

type moyuEntryDTO struct {
	ID          string            `json:"id"`
	Kind        moyu.Kind         `json:"kind" enum:"patch,save" doc:"save for a file of saved games with every picture unlocked, patch for everything else"`
	Name        string            `json:"name" doc:"Empty when the entry has no name of its own"`
	Size        *int64            `json:"size" doc:"In bytes, read from the size the other site states; null when it cannot be read"`
	Language    []string          `json:"language" enum:"en,zh,zh-hant,jp"`
	Platform    []string          `json:"platform" enum:"win,mac,ios,and,lin"`
	Translation *moyu.Translation `json:"translation" enum:"group,machine" doc:"Where the text of a translation patch comes from; null for everything else"`
	Translator  *string           `json:"translator" doc:"The translators as the other site names them; null when it names none"`
	Model       *string           `json:"model" doc:"The model a machine translation was made with; null when the other site names none"`
	Downloads   int               `json:"downloads"`
	URL         string            `json:"url" doc:"The page of the entry on the other site, where it is downloaded"`
	Updated     time.Time         `json:"updated"`
	Publisher   *moyuPublisherDTO `json:"publisher"`
}

func toEntryDTO(entry moyu.Entry) moyuEntryDTO {
	dto := moyuEntryDTO{
		ID:          entry.ID,
		Kind:        entry.Kind,
		Name:        entry.Name,
		Size:        entry.Size,
		Language:    entry.Languages,
		Platform:    entry.Platforms,
		Translation: entry.Translation,
		Translator:  filled(entry.Translator),
		Model:       filled(entry.Model),
		Downloads:   entry.Downloads,
		URL:         entry.URL,
		Updated:     entry.Updated,
	}
	if entry.Publisher != nil {
		dto.Publisher = &moyuPublisherDTO{Name: entry.Publisher.Name, Avatar: filled(entry.Publisher.Avatar)}
	}
	return dto
}

func filled(text string) *string {
	if text == "" {
		return nil
	}
	return &text
}
