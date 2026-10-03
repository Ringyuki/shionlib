package characterhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type characterPathInput struct {
	ID int `path:"id"`
}

type listCharactersInput struct {
	httpapi.PageQuery
	Q string `query:"q" doc:"Matches names and aliases"`
}
