package searchhttp

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type searchInput struct {
	httpapi.PageQuery
	Q     string   `query:"q" maxLength:"100" doc:"Keyword sent to the catalog source; when only games with resources are listed, they are kept from its first 100 hits. hid:, vid: or bid: followed by an id, or a VNDB id such as v17, finds games by that id"`
	Types []string `query:"types,explode" enum:"game,developer,character" doc:"Kinds of entries to search, one parameter per kind; games when omitted"`

	Resources string `query:"resources" enum:"any,required" doc:"Which games are found by their resources, whatever the viewer's setting: any also finds games without resources, as when picking a game to upload to, and required finds only games that have one; the viewer's setting decides when omitted"`
}

type searchRecordInput struct {
	Body struct {
		Q string `json:"q" minLength:"1" maxLength:"100" doc:"Keyword the visitor settled on"`
	}
}

type tagSearchInput struct {
	Q     string `query:"q" doc:"Matches tag names and aliases"`
	Limit int    `query:"limit" default:"10" minimum:"0" maximum:"100"`
}

type searchTrendingInput struct {
	Limit  int    `query:"limit" default:"10" minimum:"1" maximum:"50"`
	Window string `query:"window" enum:"1h,6h,1d" doc:"Single trend window; all windows are summed when omitted"`
}

type searchSuggestInput struct {
	Prefix string `query:"prefix" required:"true" minLength:"1" maxLength:"100"`
	Limit  int    `query:"limit" default:"10" minimum:"1" maximum:"20"`
}

type searchImageInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file" required:"false" doc:"JPG, PNG, WebP or GIF picture to recognize"`
	}]
}
