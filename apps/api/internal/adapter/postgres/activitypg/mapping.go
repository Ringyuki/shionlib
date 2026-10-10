package activitypg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
)

func toEntry(row *ent.Activity) activity.Entry {
	entry := activity.Entry{
		ID:      row.ID,
		Type:    activity.Type(row.Type),
		User:    userpg.ToSummary(row.Edges.User),
		GameID:  row.GameID,
		Created: row.Created,
		Updated: row.Updated,
	}
	if ref := row.Edges.Walkthrough; ref != nil {
		entry.Walkthrough = &activity.WalkthroughRef{ID: ref.ID, Title: ref.Title}
	}
	if ref := row.Edges.Comment; ref != nil {
		entry.Comment = &activity.CommentRef{ID: ref.ID, Text: ref.Text}
	}
	if ref := row.Edges.File; ref != nil {
		entry.File = &activity.FileRef{ID: ref.ID, ResourceID: ref.GameDownloadResourceID, FileName: ref.FileName, FileSize: ref.FileSize}
	}
	return entry
}
