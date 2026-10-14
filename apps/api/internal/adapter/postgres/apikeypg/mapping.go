package apikeypg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
)

func toKeys(rows []*ent.UserAPIKey) []apikey.Key {
	keys := make([]apikey.Key, len(rows))
	for i, row := range rows {
		keys[i] = toKey(row)
	}
	return keys
}

func toKey(row *ent.UserAPIKey) apikey.Key {
	return apikey.Key{
		ID:              row.ID,
		UserID:          row.UserID,
		Name:            row.Name,
		Prefix:          row.Prefix,
		Status:          apikey.Status(row.Status),
		SuspendedReason: row.SuspendedReason,
		SuspendedAt:     row.SuspendedAt,
		LastUsedAt:      row.LastUsedAt,
		LastUsedIP:      row.LastUsedIP,
		Created:         row.Created,
	}
}
