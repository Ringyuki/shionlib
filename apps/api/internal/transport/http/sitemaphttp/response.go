package sitemaphttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
)

type sitemapSectionDTO struct {
	Section string `json:"section" enum:"game,resource,walkthrough,developer,character,translator"`
	Pages   int    `json:"pages"`
}

type sitemapEntryDTO struct {
	ID       int        `json:"id"`
	GameID   *int       `json:"game_id,omitempty" doc:"The game a resource or walkthrough belongs to"`
	Modified *time.Time `json:"modified,omitempty" doc:"When what the page shows last changed; absent when it is not known"`
}

func toEntryDTO(entry sitemap.Entry) sitemapEntryDTO {
	out := sitemapEntryDTO{ID: entry.ID, Modified: entry.Modified}
	if entry.GameID != 0 {
		gameID := entry.GameID
		out.GameID = &gameID
	}
	return out
}
