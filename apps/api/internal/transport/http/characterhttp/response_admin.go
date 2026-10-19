package characterhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
)

type adminCharacterItemDTO struct {
	ID             int       `json:"id"`
	NameJP         string    `json:"name_jp"`
	NameZH         *string   `json:"name_zh"`
	NameEN         *string   `json:"name_en"`
	Image          *string   `json:"image,omitempty"`
	ImageThumbHash *string   `json:"image_thumb_hash,omitempty" doc:"ThumbHash of the image in base64"`
	Gender         []string  `json:"gender"`
	GamesCount     int       `json:"gamesCount"`
	Created        time.Time `json:"created"`
	Updated        time.Time `json:"updated"`
}

func toAdminCharacterItemDTO(entry character.AdminEntry) adminCharacterItemDTO {
	gender := entry.Gender
	if gender == nil {
		gender = []string{}
	}
	return adminCharacterItemDTO{
		ID:             entry.ID,
		NameJP:         entry.NameJP,
		NameZH:         entry.NameZH,
		NameEN:         entry.NameEN,
		Image:          entry.Image,
		ImageThumbHash: entry.ImageThumbHash,
		Gender:         gender,
		GamesCount:     entry.GamesCount,
		Created:        entry.Created,
		Updated:        entry.Updated,
	}
}
