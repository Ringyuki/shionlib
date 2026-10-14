package apikeyhttp

import (
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type keyPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type createKeyInput struct {
	Body struct {
		Name string `json:"name" minLength:"1" maxLength:"50"`
	}
}

type usageInput struct {
	Days int `query:"days" enum:"7,30,90" default:"30"`
}

type listKeysInput struct {
	httpapi.PageQuery
	Status string `query:"status" enum:"active,suspended"`
	Query  string `query:"q" maxLength:"100"`
	UserID int    `query:"user" minimum:"0"`
	Sort   string `query:"sort" enum:"requests,used,created" default:"requests"`
}

func (in *listKeysInput) filter() apikey.Filter {
	filter := apikey.Filter{Query: in.Query, Sort: apikey.Sort(in.Sort)}
	switch in.Status {
	case "active":
		status := apikey.StatusActive
		filter.Status = &status
	case "suspended":
		status := apikey.StatusSuspended
		filter.Status = &status
	}
	if in.UserID > 0 {
		filter.UserID = &in.UserID
	}
	return filter
}

type suspendKeyInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Reason string `json:"reason" minLength:"1" maxLength:"200"`
	}
}

type accountLimitInput struct {
	UserID int `path:"userId" minimum:"1"`
	Body   struct {
		Limit nullableLimitInput `json:"limit" doc:"Requests a window for every key of the account; null follows the site's limit"`
	}
}

type nullableLimitInput struct {
	Value *int
}

func (n *nullableLimitInput) UnmarshalJSON(raw []byte) error {
	return json.Unmarshal(raw, &n.Value)
}

func (nullableLimitInput) Schema(huma.Registry) *huma.Schema {
	minimum, maximum := 1.0, float64(apikey.MaxLimit)
	return &huma.Schema{Type: huma.TypeInteger, Nullable: true, Minimum: &minimum, Maximum: &maximum}
}
