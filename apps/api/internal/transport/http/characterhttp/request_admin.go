package characterhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adminCharacterListInput struct {
	httpapi.PageQuery
	Search    string `query:"search" doc:"Case-insensitive substring of the Japanese, Chinese or English name"`
	SortBy    string `query:"sortBy" default:"id" enum:"id,name,created,updated" doc:"name sorts by the Japanese name"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}
