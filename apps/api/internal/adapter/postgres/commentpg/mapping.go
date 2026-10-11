package commentpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
)

func toComment(row *ent.Comment) comment.Comment {
	return comment.Comment{
		ID:         row.ID,
		Content:    row.Content,
		Text:       row.Text,
		GameID:     row.GameID,
		ResourceID: row.ResourceID,
		PinnedAt:   row.PinnedAt,
		ParentID:   row.ParentID,
		RootID:     row.RootID,
		ReplyCount: row.ReplyCount,
		CreatorID:  row.CreatorID,
		Status:     comment.Status(row.Status),
		Edited:     row.Edited,
		Created:    row.Created,
		Updated:    row.Updated,
	}
}

func toResourceRef(row *ent.GameDownloadResource) *comment.ResourceRef {
	if row == nil {
		return nil
	}
	ref := comment.ResourceRef{ID: row.ID, GameID: row.GameID, CreatorID: row.CreatorID, FileNames: make([]string, len(row.Edges.Files))}
	for i, file := range row.Edges.Files {
		ref.FileNames[i] = file.FileName
	}
	return &ref
}
