package commenthttp

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
)

type commentPathInput struct {
	CommentID int `path:"comment_id"`
}

type createCommentInput struct {
	GameID int `path:"game_id"`
	Body   struct {
		Content  richtexthttp.Content `json:"content"`
		ParentID *int                 `json:"parent_id,omitempty"`
	}
	document richtext.Document
}

func (in *createCommentInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = richtexthttp.Parse(in.Body.Content, richtext.Comment, comment.MaxContentLength)
	return errs
}

type editCommentInput struct {
	CommentID int `path:"comment_id"`
	Body      struct {
		Content richtexthttp.Content `json:"content"`
	}
	document richtext.Document
}

func (in *editCommentInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = richtexthttp.Parse(in.Body.Content, richtext.Comment, comment.MaxContentLength)
	return errs
}

type gameCommentsInput struct {
	GameID int `path:"game_id"`
	httpapi.PageQuery
	Order string `query:"order" enum:"newest,oldest" default:"newest" doc:"Order of the threads; the replies of a thread are always oldest first"`
	Focus int    `query:"focus" minimum:"1" doc:"A comment of this game: the page that holds its thread is answered instead of the requested one; ignored when the viewer cannot see the comment"`
}

type userCommentsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
}
