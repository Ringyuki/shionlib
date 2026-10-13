package catalogpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type extraInfoRow struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func toExtraInfo(values []catalog.KeyValue) []extraInfoRow {
	rows := make([]extraInfoRow, len(values))
	for i, value := range values {
		rows[i] = extraInfoRow{Key: value.Key, Value: value.Value}
	}
	return rows
}

func toExcludedEntry(row *ent.CatalogSourceLink, names map[int]string) catalog.ExcludedEntry {
	entry := catalog.ExcludedEntry{
		Ref:   catalog.Ref{Source: row.Source, Entity: catalog.Entity(row.Entity), ExternalID: row.ExternalID},
		Title: row.Title,
	}
	if row.ExcludedAt != nil {
		entry.ExcludedAt = *row.ExcludedAt
	}
	if row.ExcludedBy != nil {
		if name, known := names[*row.ExcludedBy]; known {
			entry.ExcludedBy = &catalog.Remover{ID: *row.ExcludedBy, Name: name}
		}
	}
	return entry
}
