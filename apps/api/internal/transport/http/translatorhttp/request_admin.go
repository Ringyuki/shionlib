package translatorhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adminTranslatorListInput struct {
	httpapi.PageQuery
	Search    string `query:"search" doc:"Case-insensitive substring of the name or an alias"`
	SortBy    string `query:"sortBy" default:"works" enum:"works,resources,latest,name"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}

type adminTranslatorEditInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Name     *string   `json:"name,omitempty" minLength:"1" maxLength:"64"`
		Aliases  *[]string `json:"aliases,omitempty" maxItems:"20"`
		Homepage *string   `json:"homepage,omitempty" minLength:"0" maxLength:"512" doc:"An empty text clears the homepage"`
	}
}

type adminTranslatorMergeInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		MergedIDs []int `json:"merged_ids" minItems:"1" maxItems:"50" doc:"Translators whose credits and names move to the one in the path"`
	}
}

type adminTranslatorDismissInput struct {
	Body struct {
		IDs []int `json:"ids" minItems:"2" maxItems:"50" doc:"Translators that are not the same despite their similar names"`
	}
}
