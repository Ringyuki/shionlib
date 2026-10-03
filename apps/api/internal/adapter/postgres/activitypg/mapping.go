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
		entry.Comment = &activity.CommentRef{ID: ref.ID, HTML: ref.HTML}
	}
	if ref := row.Edges.Developer; ref != nil {
		entry.Developer = &activity.DeveloperRef{ID: ref.ID, Name: ref.Name}
	}
	if ref := row.Edges.Character; ref != nil {
		entry.Character = &activity.CharacterRef{ID: ref.ID, NameJP: ref.NameJp, NameZH: ref.NameZh, NameEN: ref.NameEn}
	}
	entry.File = fileRef(row)
	return entry
}

func fileRef(row *ent.Activity) *activity.FileRef {
	file := row.Edges.File
	if file == nil && row.FileName == nil && row.FileSize == nil {
		return nil
	}
	ref := &activity.FileRef{FileStatus: row.FileStatus, FileCheckStatus: row.FileCheckStatus}
	if file != nil {
		ref.ID = file.ID
		ref.FileName = file.FileName
		ref.FileSize = file.FileSize
		return ref
	}
	if row.FileName != nil {
		ref.FileName = *row.FileName
	}
	if row.FileSize != nil {
		ref.FileSize = *row.FileSize
	}
	return ref
}
