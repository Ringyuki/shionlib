package settingpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

func toStoredValue(row *ent.Setting) setting.StoredValue {
	return setting.StoredValue{Name: row.Name, Value: row.Value, Updated: row.Updated}
}

func toChanges(rows []*ent.SettingChange) []setting.Change {
	changes := make([]setting.Change, len(rows))
	for i, row := range rows {
		changes[i] = setting.Change{
			ID:       row.ID,
			Name:     row.Name,
			Previous: row.Previous,
			Value:    row.Value,
			Created:  row.Created,
		}
		if editor := row.Edges.Actor; editor != nil {
			changes[i].Editor = &setting.Editor{ID: editor.ID, Name: editor.Name}
		}
	}
	return changes
}
