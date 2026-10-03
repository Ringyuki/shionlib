package scanhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type malwareCasePathInput struct {
	ID int `path:"id" minimum:"1"`
}

type listMalwareCasesInput struct {
	httpapi.PageQuery
	Status         string `query:"status" enum:"PENDING,RELEASED_FALSE_POSITIVE,DELETED"`
	DecisionSource string `query:"decision_source" enum:"ADMIN_ALLOW,ADMIN_DELETE,TIMEOUT_AUTO_DELETE"`
	FileID         int    `query:"file_id" minimum:"0"`
	ResourceID     int    `query:"resource_id" minimum:"0"`
	UploaderID     int    `query:"uploader_id" minimum:"0"`
	ReviewerID     int    `query:"reviewer_id" minimum:"0"`
	SortBy         string `query:"sortBy" default:"created" enum:"id,created,updated,reviewed_at,review_deadline"`
	SortOrder      string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}

func (in *listMalwareCasesInput) filter() scan.ListFilter {
	filter := scan.ListFilter{
		FileID:     in.FileID,
		ResourceID: in.ResourceID,
		UploaderID: in.UploaderID,
		ReviewerID: in.ReviewerID,
		SortBy:     in.SortBy,
		Descending: in.SortOrder != "asc",
	}
	if in.Status != "" {
		status := scan.CaseStatus(in.Status)
		filter.Status = &status
	}
	if in.DecisionSource != "" {
		source := scan.DecisionSource(in.DecisionSource)
		filter.Source = &source
	}
	return filter
}

type reviewMalwareCaseInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Decision       scan.Decision `json:"decision" enum:"ALLOW,DELETE"`
		ReviewNote     *string       `json:"review_note,omitempty" maxLength:"500"`
		NotifyUploader *bool         `json:"notify_uploader,omitempty"`
	}
}
