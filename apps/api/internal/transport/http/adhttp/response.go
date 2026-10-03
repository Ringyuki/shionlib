package adhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
)

type adItemDTO struct {
	ID             int      `json:"id"`
	ImageZH        string   `json:"image_zh"`
	ImageJA        *string  `json:"image_ja"`
	ImageEN        *string  `json:"image_en"`
	Aspect         string   `json:"aspect"`
	Link           string   `json:"link"`
	ExcludeLocales []string `json:"exclude_locales"`
}

type adAdminDTO struct {
	ID             int        `json:"id"`
	Name           string     `json:"name"`
	Placement      []string   `json:"placement"`
	ImageZH        string     `json:"image_zh"`
	ImageJA        *string    `json:"image_ja"`
	ImageEN        *string    `json:"image_en"`
	Aspect         string     `json:"aspect"`
	Link           string     `json:"link"`
	ExcludeLocales []string   `json:"exclude_locales"`
	Enabled        bool       `json:"enabled"`
	Sort           int        `json:"sort"`
	StartAt        *time.Time `json:"start_at"`
	EndAt          *time.Time `json:"end_at"`
	Created        time.Time  `json:"created"`
	Updated        time.Time  `json:"updated"`
}

func toItemDTO(item ad.Ad) adItemDTO {
	return adItemDTO{
		ID:             item.ID,
		ImageZH:        item.ImageZH,
		ImageJA:        item.ImageJA,
		ImageEN:        item.ImageEN,
		Aspect:         item.Aspect,
		Link:           item.Link,
		ExcludeLocales: nonNil(item.ExcludeLocales),
	}
}

func toAdminDTO(item ad.Ad) adAdminDTO {
	return adAdminDTO{
		ID:             item.ID,
		Name:           item.Name,
		Placement:      nonNil(item.Placement),
		ImageZH:        item.ImageZH,
		ImageJA:        item.ImageJA,
		ImageEN:        item.ImageEN,
		Aspect:         item.Aspect,
		Link:           item.Link,
		ExcludeLocales: nonNil(item.ExcludeLocales),
		Enabled:        item.Enabled,
		Sort:           item.Sort,
		StartAt:        item.StartAt,
		EndAt:          item.EndAt,
		Created:        item.Created,
		Updated:        item.Updated,
	}
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
