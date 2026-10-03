package walkthroughpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

func toAdminEntry(row *ent.Walkthrough) walkthrough.AdminEntry {
	entry := walkthrough.AdminEntry{Walkthrough: toWalkthrough(row), Creator: userpg.ToSummary(row.Edges.Creator)}
	if row.Edges.Creator != nil {
		entry.CreatorEmail = row.Edges.Creator.Email
	}
	if g := row.Edges.Game; g != nil {
		entry.Game = walkthrough.GameRef{ID: g.ID, TitleJP: g.TitleJp, TitleZH: g.TitleZh, TitleEN: g.TitleEn}
	}
	if len(row.Edges.Moderates) > 0 {
		latest := moderationpg.ToEvent(row.Edges.Moderates[0])
		entry.Moderation = &latest
	}
	return entry
}

func toWalkthrough(row *ent.Walkthrough) walkthrough.Walkthrough {
	return walkthrough.Walkthrough{
		ID:            row.ID,
		GameID:        row.GameID,
		Title:         row.Title,
		Content:       row.Content,
		HTML:          row.HTML,
		Lang:          row.Lang,
		Created:       row.Created,
		Updated:       row.Updated,
		Edited:        row.Edited,
		Status:        walkthrough.Status(row.Status),
		CreatorID:     row.CreatorID,
		ReviewPending: row.ReviewPending,
	}
}
