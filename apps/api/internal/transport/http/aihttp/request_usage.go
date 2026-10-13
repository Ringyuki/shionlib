package aihttp

import (
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type aiCostsInput struct {
	Range      string `query:"range" enum:"1h,24h,7d,30d" default:"24h"`
	ProviderID int    `query:"provider_id" minimum:"0"`
	ModelID    int    `query:"model_id" minimum:"0"`
}

type aiBreakdownInput struct {
	Range string `query:"range" enum:"1h,24h,7d,30d" default:"24h"`
	By    string `query:"by" enum:"model,provider,route,scene" default:"model"`
}

type aiRequestSummaryInput struct {
	Range      string `query:"range" enum:"1h,24h,7d,30d" default:"24h"`
	Scene      string `query:"scene" maxLength:"64"`
	ModelID    int    `query:"model_id" minimum:"0"`
	ProviderID int    `query:"provider_id" minimum:"0"`
	RouteID    int    `query:"route_id" minimum:"0"`
	Source     string `query:"source" enum:"scene,check,playground"`
	OK         string `query:"ok" enum:"true,false"`
	ErrorKind  string `query:"error_kind" enum:"auth,quota,not_found,protocol,param,structured,rate_limit,upstream,network,timeout,malformed,truncated,other"`
}

func (in *aiRequestSummaryInput) query() ai.RequestQuery {
	return requestQuery(*in)
}

type aiRequestListInput struct {
	httpapi.PageQuery
	Range      string `query:"range" enum:"1h,24h,7d,30d" default:"24h"`
	Scene      string `query:"scene" maxLength:"64"`
	ModelID    int    `query:"model_id" minimum:"0"`
	ProviderID int    `query:"provider_id" minimum:"0"`
	RouteID    int    `query:"route_id" minimum:"0"`
	Source     string `query:"source" enum:"scene,check,playground"`
	OK         string `query:"ok" enum:"true,false"`
	ErrorKind  string `query:"error_kind" enum:"auth,quota,not_found,protocol,param,structured,rate_limit,upstream,network,timeout,malformed,truncated,other"`
}

func (in *aiRequestListInput) query() ai.RequestQuery {
	return requestQuery(aiRequestSummaryInput{Range: in.Range, Scene: in.Scene, ModelID: in.ModelID, ProviderID: in.ProviderID, RouteID: in.RouteID, Source: in.Source, OK: in.OK, ErrorKind: in.ErrorKind})
}

func requestQuery(in aiRequestSummaryInput) ai.RequestQuery {
	query := ai.RequestQuery{Range: rangeOf(in.Range), ModelID: positive(in.ModelID), ProviderID: positive(in.ProviderID), RouteID: positive(in.RouteID)}
	if in.Scene != "" {
		scene := in.Scene
		query.Scene = &scene
	}
	if in.Source != "" {
		source := ai.Source(in.Source)
		query.Source = &source
	}
	if in.OK != "" {
		ok := in.OK == "true"
		query.OK = &ok
	}
	if in.ErrorKind != "" {
		kind := ai.ErrorKind(in.ErrorKind)
		query.ErrorKind = &kind
	}
	return query
}

type aiRequestPathInput struct {
	ID string `path:"id" pattern:"^[0-9]{1,18}$"`
}

func (in *aiRequestPathInput) requestID() int64 {
	id, _ := strconv.ParseInt(in.ID, 10, 64)
	return id
}
