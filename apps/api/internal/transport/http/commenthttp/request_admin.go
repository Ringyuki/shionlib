package commenthttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adminCommentPathInput struct {
	ID int `path:"id"`
}

type adminCommentListInput struct {
	httpapi.PageQuery
	Search    string `query:"search"`
	SortBy    string `query:"sortBy" default:"created" enum:"id,created,updated,status"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
	Status    int    `query:"status" enum:"1,2,3"`
	CreatorID int    `query:"creatorId"`
	GameID    int    `query:"gameId"`
}

func (in *adminCommentListInput) filter() comment.AdminFilter {
	filter := comment.AdminFilter{
		Search:     in.Search,
		SortBy:     comment.SortField(in.SortBy),
		Descending: in.SortOrder != "asc",
	}
	if in.Status != 0 {
		status := comment.Status(in.Status)
		filter.Status = &status
	}
	if in.CreatorID != 0 {
		filter.CreatorID = &in.CreatorID
	}
	if in.GameID != 0 {
		filter.GameID = &in.GameID
	}
	return filter
}

type adminCommentStatusInput struct {
	ID   int `path:"id"`
	Body struct {
		Status      int     `json:"status" enum:"1,2,3" doc:"1 visible, 2 pending review, 3 blocked"`
		TopCategory *string `json:"top_category,omitempty" enum:"HARASSMENT,HARASSMENT_THREATENING,SEXUAL,SEXUAL_MINORS,HATE,HATE_THREATENING,ILLICIT,ILLICIT_VIOLENT,SELF_HARM,SELF_HARM_INTENT,SELF_HARM_INSTRUCTIONS,VIOLENCE,VIOLENCE_GRAPHIC,SPAM,MEANINGLESS"`
		Reason      *string `json:"reason,omitempty" maxLength:"2550"`
		Evidence    *string `json:"evidence,omitempty" maxLength:"1000"`
		Notify      *bool   `json:"notify,omitempty" doc:"Defaults to true; only used when blocking"`
	}
}

func (in *adminCommentStatusInput) change() comment.StatusChange {
	change := comment.StatusChange{
		Status:   comment.Status(in.Body.Status),
		Reason:   in.Body.Reason,
		Evidence: in.Body.Evidence,
		Notify:   in.Body.Notify,
	}
	if in.Body.TopCategory != nil {
		category := moderation.Category(*in.Body.TopCategory)
		change.TopCategory = &category
	}
	return change
}
