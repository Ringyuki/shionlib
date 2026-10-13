package developerhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adminDeveloperListInput struct {
	httpapi.PageQuery
	Search    string `query:"search" doc:"Case-insensitive substring of the name"`
	SortBy    string `query:"sortBy" default:"id" enum:"id,name,created,updated"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}
