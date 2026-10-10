package walkthroughhttp

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type walkthroughPathInput struct {
	ID int `path:"id"`
}

type createWalkthroughInput struct {
	Body struct {
		GameID  int                  `json:"game_id"`
		Title   string               `json:"title" minLength:"1" maxLength:"255"`
		Content richtexthttp.Content `json:"content"`
		Status  string               `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	}
	document richtext.Document
}

func (in *createWalkthroughInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = richtexthttp.Parse(in.Body.Content, richtext.Article, walkthrough.MaxContentLength)
	return errs
}

type updateWalkthroughInput struct {
	ID   int `path:"id"`
	Body struct {
		Title   string               `json:"title" minLength:"1" maxLength:"255"`
		Content richtexthttp.Content `json:"content"`
		Status  string               `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	}
	document richtext.Document
}

func (in *updateWalkthroughInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = richtexthttp.Parse(in.Body.Content, richtext.Article, walkthrough.MaxContentLength)
	return errs
}

type getWalkthroughInput struct {
	ID          int    `path:"id"`
	WithContent string `query:"withContent" doc:"Only the literal true includes the editor state"`
}

type gameWalkthroughsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
	Status string `query:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
}

type userWalkthroughsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
	Status string `query:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
}
