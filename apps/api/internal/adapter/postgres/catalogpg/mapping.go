package catalogpg

import "github.com/Ringyuki/shionlib/apps/api/internal/catalog"

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
