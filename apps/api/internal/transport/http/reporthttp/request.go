package reporthttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type reportPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type createReportInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Reason report.Reason `json:"reason" enum:"MALWARE,IRRELEVANT,BROKEN_LINK,MISLEADING_CONTENT,OTHER"`
		Detail *string       `json:"detail,omitempty" maxLength:"500"`
	}
}

type listReportsInput struct {
	httpapi.PageQuery
	Status         string `query:"status" enum:"PENDING,VALID,INVALID"`
	Reason         string `query:"reason" enum:"MALWARE,IRRELEVANT,BROKEN_LINK,MISLEADING_CONTENT,OTHER"`
	MaliciousLevel string `query:"malicious_level" enum:"LOW,MEDIUM,HIGH,CRITICAL"`
	ResourceID     int    `query:"resource_id" minimum:"0"`
	ReporterID     int    `query:"reporter_id" minimum:"0"`
	ReportedUserID int    `query:"reported_user_id" minimum:"0"`
	SortBy         string `query:"sortBy" default:"created" enum:"id,created,updated,processed_at"`
	SortOrder      string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}

func (in *listReportsInput) filter() report.ListFilter {
	filter := report.ListFilter{
		ResourceID:     in.ResourceID,
		ReporterID:     in.ReporterID,
		ReportedUserID: in.ReportedUserID,
		SortBy:         in.SortBy,
		Descending:     in.SortOrder != "asc",
	}
	if in.Status != "" {
		status := report.Status(in.Status)
		filter.Status = &status
	}
	if in.Reason != "" {
		reason := report.Reason(in.Reason)
		filter.Reason = &reason
	}
	if in.MaliciousLevel != "" {
		level := report.Level(in.MaliciousLevel)
		filter.Level = &level
	}
	return filter
}

type reviewReportInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Verdict        report.Verdict `json:"verdict" enum:"VALID,INVALID"`
		MaliciousLevel *report.Level  `json:"malicious_level,omitempty" enum:"LOW,MEDIUM,HIGH,CRITICAL"`
		ProcessNote    *string        `json:"process_note,omitempty" maxLength:"500"`
		Notify         *bool          `json:"notify,omitempty"`
		RemoveResource *bool          `json:"remove_resource,omitempty"`
	}
}
