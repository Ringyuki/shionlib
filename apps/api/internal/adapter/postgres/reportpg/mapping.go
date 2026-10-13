package reportpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func toView(row *ent.GameDownloadResourceReport) report.View {
	view := report.View{
		Report:       toReport(row),
		Reporter:     toMember(row.Edges.Reporter),
		ReportedUser: toMember(row.Edges.ReportedUser),
		Processor:    userpg.ToSummaryPtr(row.Edges.Processor),
		Resource:     report.ResourceRef{ID: row.ResourceID, Files: []report.FileRef{}},
	}
	resource := row.Edges.Resource
	if resource == nil {
		return view
	}
	view.Resource.GameID = resource.GameID
	view.Resource.Note = resource.Note
	view.Resource.Game = report.GameTitles{ID: resource.GameID}
	if gameRow := resource.Edges.Game; gameRow != nil {
		view.Resource.Game = report.GameTitles{ID: gameRow.ID, TitleJP: gameRow.TitleJp, TitleZH: gameRow.TitleZh, TitleEN: gameRow.TitleEn}
	}
	for _, file := range resource.Edges.Files {
		view.Resource.Files = append(view.Resource.Files, report.FileRef{
			ID:            file.ID,
			Name:          file.FileName,
			Size:          file.FileSize,
			Status:        file.FileStatus,
			CheckStatus:   file.FileCheckStatus,
			HashAlgorithm: upload.HashAlgorithm(file.HashAlgorithm),
			Hash:          file.FileHash,
		})
	}
	return view
}

func toMember(row *ent.User) report.Member {
	if row == nil {
		return report.Member{}
	}
	return report.Member{Summary: userpg.ToSummary(row), Role: row.Role, Status: row.Status}
}

func toReport(row *ent.GameDownloadResourceReport) report.Report {
	return report.Report{
		ID:                     row.ID,
		ResourceID:             row.ResourceID,
		ReporterID:             row.ReporterID,
		ReportedUserID:         row.ReportedUserID,
		Reason:                 report.Reason(row.Reason),
		Detail:                 row.Detail,
		Status:                 report.Status(row.Status),
		Level:                  report.Level(row.MaliciousLevel),
		ProcessedBy:            row.ProcessedBy,
		ProcessedAt:            row.ProcessedAt,
		ProcessNote:            row.ProcessNote,
		ReporterPenaltyApplied: row.ReporterPenaltyApplied,
		ReportedPenaltyApplied: row.ReportedPenaltyApplied,
		Created:                row.Created,
		Updated:                row.Updated,
	}
}
