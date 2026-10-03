package reporthttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type reportPath struct {
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

type reportCreatedDTO struct {
	ID             int           `json:"id"`
	Status         report.Status `json:"status"`
	Reason         report.Reason `json:"reason"`
	MaliciousLevel report.Level  `json:"malicious_level"`
	Created        time.Time     `json:"created"`
}

type reportGameDTO struct {
	ID      int    `json:"id"`
	TitleJP string `json:"title_jp"`
	TitleZH string `json:"title_zh"`
	TitleEN string `json:"title_en"`
}

type reportFileNameDTO struct {
	ID       int    `json:"id"`
	FileName string `json:"file_name"`
}

type reportListResourceDTO struct {
	ID     int                 `json:"id"`
	GameID int                 `json:"game_id"`
	Game   reportGameDTO       `json:"game"`
	Files  []reportFileNameDTO `json:"files"`
}

type reportListItemDTO struct {
	ID             int                   `json:"id"`
	Reason         report.Reason         `json:"reason"`
	Detail         *string               `json:"detail"`
	Status         report.Status         `json:"status"`
	MaliciousLevel report.Level          `json:"malicious_level"`
	ProcessedAt    *time.Time            `json:"processed_at"`
	ProcessNote    *string               `json:"process_note"`
	Created        time.Time             `json:"created"`
	Updated        time.Time             `json:"updated"`
	Resource       reportListResourceDTO `json:"resource"`
	Reporter       userhttp.UserSummary  `json:"reporter"`
	ReportedUser   userhttp.UserSummary  `json:"reported_user"`
	Processor      *userhttp.UserSummary `json:"processor"`
}

type reportFileDTO struct {
	ID              int                  `json:"id"`
	FileName        string               `json:"file_name"`
	FileSize        int64                `json:"file_size"`
	FileStatus      int                  `json:"file_status"`
	FileCheckStatus int                  `json:"file_check_status"`
	HashAlgorithm   upload.HashAlgorithm `json:"hash_algorithm" enum:"sha256,blake3"`
	FileHash        string               `json:"file_hash"`
}

type reportDetailResourceDTO struct {
	ID     int             `json:"id"`
	GameID int             `json:"game_id"`
	Note   *string         `json:"note"`
	Game   reportGameDTO   `json:"game"`
	Files  []reportFileDTO `json:"files"`
}

type reportMemberDTO struct {
	userhttp.UserSummary
	Role   int `json:"role"`
	Status int `json:"status"`
}

type reportDetailDTO struct {
	ID                     int                     `json:"id"`
	Reason                 report.Reason           `json:"reason"`
	Detail                 *string                 `json:"detail"`
	Status                 report.Status           `json:"status"`
	MaliciousLevel         report.Level            `json:"malicious_level"`
	ProcessNote            *string                 `json:"process_note"`
	ProcessedAt            *time.Time              `json:"processed_at"`
	ReporterPenaltyApplied bool                    `json:"reporter_penalty_applied"`
	ReportedPenaltyApplied bool                    `json:"reported_penalty_applied"`
	Created                time.Time               `json:"created"`
	Updated                time.Time               `json:"updated"`
	Resource               reportDetailResourceDTO `json:"resource"`
	Reporter               reportMemberDTO         `json:"reporter"`
	ReportedUser           reportMemberDTO         `json:"reported_user"`
	Processor              *userhttp.UserSummary   `json:"processor"`
}

func toGameDTO(t report.GameTitles) reportGameDTO {
	return reportGameDTO{ID: t.ID, TitleJP: t.TitleJP, TitleZH: t.TitleZH, TitleEN: t.TitleEN}
}

func toMemberDTO(m report.Member, now time.Time) reportMemberDTO {
	return reportMemberDTO{UserSummary: userhttp.ToUserSummary(m.Summary, now), Role: m.Role, Status: m.Status}
}

func toListItemDTO(v report.View, now time.Time) reportListItemDTO {
	files := make([]reportFileNameDTO, len(v.Resource.Files))
	for i, file := range v.Resource.Files {
		files[i] = reportFileNameDTO{ID: file.ID, FileName: file.Name}
	}
	return reportListItemDTO{
		ID:             v.ID,
		Reason:         v.Reason,
		Detail:         v.Detail,
		Status:         v.Status,
		MaliciousLevel: v.Level,
		ProcessedAt:    v.ProcessedAt,
		ProcessNote:    v.ProcessNote,
		Created:        v.Created,
		Updated:        v.Updated,
		Resource:       reportListResourceDTO{ID: v.Resource.ID, GameID: v.Resource.GameID, Game: toGameDTO(v.Resource.Game), Files: files},
		Reporter:       userhttp.ToUserSummary(v.Reporter.Summary, now),
		ReportedUser:   userhttp.ToUserSummary(v.ReportedUser.Summary, now),
		Processor:      userhttp.ToUserSummaryPtr(v.Processor, now),
	}
}

func toDetailDTO(v report.View, now time.Time) reportDetailDTO {
	files := make([]reportFileDTO, len(v.Resource.Files))
	for i, file := range v.Resource.Files {
		files[i] = reportFileDTO{
			ID:              file.ID,
			FileName:        file.Name,
			FileSize:        file.Size,
			FileStatus:      file.Status,
			FileCheckStatus: file.CheckStatus,
			HashAlgorithm:   file.HashAlgorithm,
			FileHash:        file.Hash,
		}
	}
	return reportDetailDTO{
		ID:                     v.ID,
		Reason:                 v.Reason,
		Detail:                 v.Detail,
		Status:                 v.Status,
		MaliciousLevel:         v.Level,
		ProcessNote:            v.ProcessNote,
		ProcessedAt:            v.ProcessedAt,
		ReporterPenaltyApplied: v.ReporterPenaltyApplied,
		ReportedPenaltyApplied: v.ReportedPenaltyApplied,
		Created:                v.Created,
		Updated:                v.Updated,
		Resource:               reportDetailResourceDTO{ID: v.Resource.ID, GameID: v.Resource.GameID, Note: v.Resource.Note, Game: toGameDTO(v.Resource.Game), Files: files},
		Reporter:               toMemberDTO(v.Reporter, now),
		ReportedUser:           toMemberDTO(v.ReportedUser, now),
		Processor:              userhttp.ToUserSummaryPtr(v.Processor, now),
	}
}
