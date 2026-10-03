package commenthttp

import (
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/lexicalhttp"
)

type commentPathInput struct {
	CommentID int `path:"comment_id"`
}

type createCommentInput struct {
	GameID int `path:"game_id"`
	Body   struct {
		Content  json.RawMessage `json:"content" doc:"Lexical editor state"`
		ParentID *int            `json:"parent_id,omitempty"`
	}
	document lexical.Document
}

func (in *createCommentInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = lexicalhttp.Parse(in.Body.Content, comment.MaxContentLength)
	return errs
}

type editCommentInput struct {
	CommentID int `path:"comment_id"`
	Body      struct {
		Content json.RawMessage `json:"content" doc:"Lexical editor state"`
	}
	document lexical.Document
}

func (in *editCommentInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = lexicalhttp.Parse(in.Body.Content, comment.MaxContentLength)
	return errs
}

type gameCommentsInput struct {
	GameID int `path:"game_id"`
	httpapi.PageQuery
}

type userCommentsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
}
