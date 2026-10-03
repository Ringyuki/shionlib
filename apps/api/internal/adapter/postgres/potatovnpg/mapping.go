package potatovnpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

func toBinding(row *ent.UserPvnBinding) potatovn.Binding {
	return potatovn.Binding{
		UserID:        row.UserID,
		PVNUserID:     row.PvnUserID,
		PVNUserName:   row.PvnUserName,
		PVNUserAvatar: row.PvnUserAvatar,
		Token:         row.PvnToken,
		TokenExpires:  row.PvnTokenExpires,
		Created:       row.Created,
		Updated:       row.Updated,
	}
}

func toMapping(row *ent.UserGamePvnMapping) potatovn.Mapping {
	return potatovn.Mapping{
		UserID:       row.UserID,
		GameID:       row.GameID,
		PVNGalgameID: row.PvnGalgameID,
		PlayData: potatovn.PlayData{
			TotalPlayTime: row.TotalPlayTime,
			LastPlayDate:  row.LastPlayDate,
			PlayType:      row.PlayType,
			MyRate:        row.MyRate,
		},
		SyncedAt: row.SyncedAt,
	}
}
