package cataloghttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type catalogSourceDTO struct {
	Name        string     `json:"name"`
	Incremental bool       `json:"incremental" doc:"Whether the source reports its changes, so they can be pulled"`
	Games       int        `json:"games" doc:"Games of the source that are kept here"`
	Developers  int        `json:"developers"`
	Characters  int        `json:"characters"`
	Cursor      string     `json:"cursor" doc:"Position in the change feed of the source; empty before the first pull"`
	PulledAt    *time.Time `json:"pulled_at" doc:"When the changes were last pulled"`
	Changes     int        `json:"changes" doc:"Changes the last pull applied"`
	FailedAt    *time.Time `json:"failed_at" doc:"When a pull failed since the last one that worked"`
	LastError   *string    `json:"last_error"`
	Refreshes   int64      `json:"refresh_seconds" doc:"Entries that were not synced for this long are fetched again"`
}

func toCatalogSourceDTO(status catalog.SourceStatus) catalogSourceDTO {
	return catalogSourceDTO{
		Name:        status.Name,
		Incremental: status.Incremental,
		Games:       status.Counts.Games,
		Developers:  status.Counts.Developers,
		Characters:  status.Counts.Characters,
		Cursor:      status.Sync.Cursor,
		PulledAt:    status.Sync.PulledAt,
		Changes:     status.Sync.Changes,
		FailedAt:    status.Sync.FailedAt,
		LastError:   status.Sync.LastError,
		Refreshes:   int64(status.Refreshes / time.Second),
	}
}

type catalogHitDTO struct {
	ExternalID string  `json:"external_id"`
	Title      string  `json:"title" doc:"Empty for an entry that is offered by its number alone, because the search did not list it"`
	Subtitle   *string `json:"subtitle"`
	Developer  *string `json:"developer"`
	Cover      *string `json:"cover"`
	LocalID    *int    `json:"local_id" doc:"The entry here, when it was imported"`
	Excluded   bool    `json:"excluded" doc:"Whether the entry is kept out of imports"`
}

func toCatalogHitDTO(hit catalog.SearchHit) catalogHitDTO {
	dto := catalogHitDTO{ExternalID: hit.ExternalID, Title: hit.Title, Subtitle: hit.Subtitle, Developer: hit.Developer, Cover: hit.CoverURL}
	if link := hit.Link; link != nil {
		dto.Excluded = link.Excluded
		if !link.Excluded {
			dto.LocalID = &link.LocalID
		}
	}
	return dto
}

type catalogImportedDTO struct {
	ID int `json:"id"`
}

type catalogRemoverDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type catalogExcludedDTO struct {
	Source     string             `json:"source"`
	Entity     string             `json:"entity" enum:"game,developer,character"`
	ExternalID string             `json:"external_id"`
	Title      *string            `json:"title" doc:"The name of the entry when it was removed"`
	ExcludedAt time.Time          `json:"excluded_at"`
	ExcludedBy *catalogRemoverDTO `json:"excluded_by"`
}

func toCatalogExcludedDTO(entry catalog.ExcludedEntry) catalogExcludedDTO {
	dto := catalogExcludedDTO{
		Source:     entry.Ref.Source,
		Entity:     string(entry.Ref.Entity),
		ExternalID: entry.Ref.ExternalID,
		Title:      entry.Title,
		ExcludedAt: entry.ExcludedAt,
	}
	if by := entry.ExcludedBy; by != nil {
		dto.ExcludedBy = &catalogRemoverDTO{ID: by.ID, Name: by.Name}
	}
	return dto
}
