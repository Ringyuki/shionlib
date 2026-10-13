package translatorhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type translatorPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type listTranslatorsInput struct {
	httpapi.PageQuery
	Q string `query:"q" doc:"Matches names and aliases"`
}

type suggestTranslatorsInput struct {
	Q string `query:"q" maxLength:"64" doc:"Matches names and aliases, including translators without published works; left empty, the translators with the most works are suggested"`
}
