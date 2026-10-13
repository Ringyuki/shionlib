package moderationpg

import (
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

func ToEvent(row *ent.ModerationEvent) moderation.Event {
	event := moderation.Event{
		ID:          row.ID,
		Auditor:     moderation.Auditor(row.AuditBy),
		Model:       row.Model,
		Decision:    moderation.Decision(row.Decision),
		TopCategory: moderation.Category(row.TopCategory),
		Categories:  row.CategoriesJSON,
		Scores:      row.ScoresJSON,
		Reason:      row.Reason,
		Evidence:    row.Evidence,
		Created:     row.CreatedAt,
	}
	if row.MaxScore != nil {
		if score, err := strconv.ParseFloat(*row.MaxScore, 64); err == nil {
			event.MaxScore = &score
		}
	}
	return event
}
