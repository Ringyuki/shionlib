package developerpg

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
)

func toDeveloper(row *ent.GameDeveloper) developer.Developer {
	return developer.Developer{
		ID:        row.ID,
		HID:       row.HID,
		Name:      row.Name,
		Aliases:   nonNil(row.Aliases),
		Logo:      row.Logo,
		IntroJP:   row.IntroJp,
		IntroZH:   row.IntroZh,
		IntroEN:   row.IntroEn,
		Website:   row.Website,
		ExtraInfo: decodeExtraInfo(row.ExtraInfo),
		ParentID:  row.ParentDeveloperID,
	}
}

func decodeExtraInfo(raw []byte) []developer.ExtraInfo {
	var entries []map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &entries) != nil {
		return []developer.ExtraInfo{}
	}
	out := make([]developer.ExtraInfo, 0, len(entries))
	for _, entry := range entries {
		out = append(out, developer.ExtraInfo{Key: text(entry["key"]), Value: text(entry["value"])})
	}
	return out
}

func text(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	default:
		return fmt.Sprint(typed)
	}
}
