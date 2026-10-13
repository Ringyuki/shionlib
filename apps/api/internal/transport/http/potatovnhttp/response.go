package potatovnhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

type potatoVNBindingDTO struct {
	PVNUserID       int       `json:"pvn_user_id"`
	PVNUserName     string    `json:"pvn_user_name"`
	PVNUserAvatar   *string   `json:"pvn_user_avatar"`
	PVNTokenExpires time.Time `json:"pvn_token_expires"`
	Created         time.Time `json:"created"`
	Updated         time.Time `json:"updated"`
}

type potatoVNGameDataDTO struct {
	PVNGalgameID  int        `json:"pvn_galgame_id"`
	TotalPlayTime int        `json:"total_play_time"`
	LastPlayDate  *time.Time `json:"last_play_date"`
	PlayType      int        `json:"play_type"`
	MyRate        int        `json:"my_rate"`
	SyncedAt      time.Time  `json:"synced_at"`
}

func toBindingDTO(binding potatovn.Binding) potatoVNBindingDTO {
	return potatoVNBindingDTO{
		PVNUserID:       binding.PVNUserID,
		PVNUserName:     binding.PVNUserName,
		PVNUserAvatar:   binding.PVNUserAvatar,
		PVNTokenExpires: binding.TokenExpires,
		Created:         binding.Created,
		Updated:         binding.Updated,
	}
}

func toGameDataDTO(mapping potatovn.Mapping) potatoVNGameDataDTO {
	return potatoVNGameDataDTO{
		PVNGalgameID:  mapping.PVNGalgameID,
		TotalPlayTime: mapping.TotalPlayTime,
		LastPlayDate:  mapping.LastPlayDate,
		PlayType:      mapping.PlayType,
		MyRate:        mapping.MyRate,
		SyncedAt:      mapping.SyncedAt,
	}
}
