package searchhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type searchGamesInput struct {
	httpapi.PageQuery
	Q   string `query:"q" doc:"Keyword matched against titles, aliases, tags and developers"`
	Tag string `query:"tag" doc:"Exact tag name"`
}

type searchTagsInput struct {
	Q     string `query:"q" doc:"Matches tag names and aliases"`
	Limit int    `query:"limit" default:"10" minimum:"0" maximum:"100"`
}

type searchTrendingInput struct {
	Limit  int    `query:"limit" default:"10" minimum:"1" maximum:"50"`
	Window string `query:"window" enum:"1h,6h,1d" doc:"Single trend window; all windows are summed when omitted"`
}

type searchSuggestInput struct {
	Prefix string `query:"prefix" required:"true" minLength:"1"`
	Limit  int    `query:"limit" default:"10" minimum:"1" maximum:"50"`
}
