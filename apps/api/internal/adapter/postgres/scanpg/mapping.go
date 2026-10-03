package scanpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

func toView(row *ent.MalwareScanCase) scan.CaseView {
	view := scan.CaseView{Case: toCase(row), Reviewer: userpg.ToSummaryPtr(row.Edges.Reviewer)}
	if file := row.Edges.File; file != nil {
		view.File = toCaseFile(file)
	}
	if resource := row.Edges.Resource; resource != nil {
		ref := &scan.CaseResource{ID: resource.ID, GameID: resource.GameID, Note: resource.Note, Game: scan.GameTitles{ID: resource.GameID}}
		if gameRow := resource.Edges.Game; gameRow != nil {
			ref.Game = toTitles(gameRow)
		}
		view.Resource = ref
	}
	if uploader := row.Edges.Uploader; uploader != nil {
		view.Uploader = scan.Member{Summary: userpg.ToSummary(uploader), Role: uploader.Role, Status: uploader.Status}
	}
	return view
}

func toPendingFile(row *ent.GameDownloadResourceFile) scan.PendingFile {
	file := scan.PendingFile{
		ID:              row.ID,
		ResourceID:      row.GameDownloadResourceID,
		Type:            row.Type,
		Status:          row.FileStatus,
		CheckStatus:     download.CheckStatus(row.FileCheckStatus),
		Name:            row.FileName,
		Size:            row.FileSize,
		Hash:            row.FileHash,
		HashAlgorithm:   string(row.HashAlgorithm),
		UploadSessionID: row.UploadSessionID,
		CreatorID:       row.CreatorID,
	}
	if row.FilePath != nil {
		file.Path = *row.FilePath
	}
	if resource := row.Edges.GameDownloadResource; resource != nil {
		file.GameID = resource.GameID
	}
	return file
}

func toCaseFile(row *ent.GameDownloadResourceFile) *scan.CaseFile {
	return &scan.CaseFile{
		ID:              row.ID,
		Type:            row.Type,
		Status:          row.FileStatus,
		CheckStatus:     row.FileCheckStatus,
		FalsePositive:   row.IsVirusFalsePositive,
		UploadSessionID: row.UploadSessionID,
		CreatorID:       row.CreatorID,
		Name:            row.FileName,
		Size:            row.FileSize,
		Path:            row.FilePath,
	}
}

func toCase(row *ent.MalwareScanCase) scan.Case {
	result := scan.Case{
		ID:                 row.ID,
		FileID:             row.FileID,
		ResourceID:         row.ResourceID,
		GameID:             row.GameID,
		UploaderID:         row.UploaderID,
		ReviewedBy:         row.ReviewedBy,
		Status:             scan.CaseStatus(row.Status),
		ReviewNote:         row.ReviewNote,
		ReviewDeadline:     row.ReviewDeadline,
		ReviewedAt:         row.ReviewedAt,
		Detector:           row.Detector,
		Viruses:            nonNil(row.DetectedViruses),
		ScanLogPath:        row.ScanLogPath,
		ScanLogExcerpt:     row.ScanLogExcerpt,
		NotifyOnAllow:      row.NotifyUploaderOnAllow,
		UploaderNotifiedAt: row.UploaderNotifiedAt,
		FileName:           row.FileName,
		FileSize:           row.FileSize,
		FileHash:           row.FileHash,
		Created:            row.Created,
		Updated:            row.Updated,
	}
	if len(row.ScanResult) > 0 {
		result.ScanResult = row.ScanResult
	}
	if row.DecisionSource != nil {
		source := scan.DecisionSource(*row.DecisionSource)
		result.DecisionSource = &source
	}
	if row.HashAlgorithm != nil {
		algorithm := string(*row.HashAlgorithm)
		result.HashAlgorithm = &algorithm
	}
	return result
}

func toTitles(row *ent.Game) scan.GameTitles {
	return scan.GameTitles{ID: row.ID, TitleJP: row.TitleJp, TitleZH: row.TitleZh, TitleEN: row.TitleEn}
}
