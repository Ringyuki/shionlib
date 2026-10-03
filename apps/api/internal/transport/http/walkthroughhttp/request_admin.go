package walkthroughhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type adminWalkthroughPathInput struct {
	ID int `path:"id"`
}

type adminWalkthroughListInput struct {
	httpapi.PageQuery
	Search    string `query:"search"`
	SortBy    string `query:"sortBy" default:"created" enum:"id,title,created,updated,status"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
	Status    string `query:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	CreatorID int    `query:"creatorId"`
	GameID    int    `query:"gameId"`
}

func (in *adminWalkthroughListInput) filter() walkthrough.AdminFilter {
	filter := walkthrough.AdminFilter{
		Search:     in.Search,
		Status:     statusFilter(in.Status),
		SortBy:     walkthrough.SortField(in.SortBy),
		Descending: in.SortOrder != "asc",
	}
	if in.CreatorID != 0 {
		filter.CreatorID = &in.CreatorID
	}
	if in.GameID != 0 {
		filter.GameID = &in.GameID
	}
	return filter
}

type adminWalkthroughStatusInput struct {
	ID   int `path:"id"`
	Body struct {
		Status string `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	}
}
