package searchhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type searchInput struct {
	httpapi.PageQuery
	Q     string   `query:"q" maxLength:"100" doc:"Keyword sent to the catalog source; when only games with resources are listed, they are kept from its first 100 hits. hid:, vid: or bid: followed by an id, or a VNDB id such as v17, finds games by that id"`
	Types []string `query:"types,explode" enum:"game,developer,character" doc:"Kinds of entries to search, one parameter per kind; games when omitted"`

	IncludeWithoutResources bool `query:"include_without_resources" doc:"Also find games without resources, whatever the viewer's setting, as when picking a game to upload to"`
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
