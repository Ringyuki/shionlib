package commentpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
)

func toComment(row *ent.Comment) comment.Comment {
	return comment.Comment{
		ID:         row.ID,
		Content:    row.Content,
		HTML:       row.HTML,
		GameID:     row.GameID,
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
