package cataloghttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type catalogSearchInput struct {
	httpapi.PageQuery
	Source string `query:"source" default:"hikarinagi" doc:"Catalog source name"`
	Query  string `query:"q" required:"true" minLength:"1" maxLength:"100" doc:"Search keyword"`
}

type catalogImportInput struct {
	Body struct {
		Source     string `json:"source,omitempty" default:"hikarinagi" doc:"Catalog source name"`
		Entity     string `json:"entity" enum:"game,developer,character" doc:"Entry kind"`
		ExternalID string `json:"external_id" minLength:"1" maxLength:"64" doc:"Entry id at the source"`
	}
}

func (in *catalogImportInput) ref() catalog.Ref {
	return catalog.Ref{Source: in.Body.Source, Entity: catalog.Entity(in.Body.Entity), ExternalID: in.Body.ExternalID}
}
