package developerhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type developerPathInput struct {
	ID int `path:"id"`
}

type listDevelopersInput struct {
	httpapi.PageQuery
	Q string `query:"q" doc:"Matches names and aliases"`
}
