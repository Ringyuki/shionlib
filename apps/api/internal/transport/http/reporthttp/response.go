package reporthttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

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
	ID             int                      `json:"id"`
	Reason         report.Reason            `json:"reason"`
	Detail         *string                  `json:"detail"`
	Status         report.Status            `json:"status"`
	MaliciousLevel report.Level             `json:"malicious_level"`
	ProcessedAt    *time.Time               `json:"processed_at"`
	ProcessNote    *string                  `json:"process_note"`
	Created        time.Time                `json:"created"`
	Updated        time.Time                `json:"updated"`
	Resource       reportListResourceDTO    `json:"resource"`
	Reporter       userhttp.UserSummaryDTO  `json:"reporter"`
	ReportedUser   userhttp.UserSummaryDTO  `json:"reported_user"`
	Processor      *userhttp.UserSummaryDTO `json:"processor"`
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
	userhttp.UserSummaryDTO
	Role   int `json:"role"`
	Status int `json:"status"`
}

type reportDetailDTO struct {
	ID                     int                      `json:"id"`
	Reason                 report.Reason            `json:"reason"`
	Detail                 *string                  `json:"detail"`
	Status                 report.Status            `json:"status"`
	MaliciousLevel         report.Level             `json:"malicious_level"`
	ProcessNote            *string                  `json:"process_note"`
	ProcessedAt            *time.Time               `json:"processed_at"`
	ReporterPenaltyApplied bool                     `json:"reporter_penalty_applied"`
	ReportedPenaltyApplied bool                     `json:"reported_penalty_applied"`
	Created                time.Time                `json:"created"`
	Updated                time.Time                `json:"updated"`
	Resource               reportDetailResourceDTO  `json:"resource"`
	Reporter               reportMemberDTO          `json:"reporter"`
	ReporterRecord         reporterRecordDTO        `json:"reporter_record"`
	ReportedUser           reportMemberDTO          `json:"reported_user"`
	Processor              *userhttp.UserSummaryDTO `json:"processor"`
}

type reporterRecordDTO struct {
	Filed       int `json:"filed" doc:"Reports this user filed, this one included"`
	Invalid     int `json:"invalid" doc:"Of those, found invalid"`
	NextInvalid int `json:"next_invalid" doc:"Invalid reports in the penalty window, this one counted while it is pending"`
}

type reportPenaltyDTO struct {
	BanDays   int  `json:"ban_days" doc:"0 when the uploader is not banned"`
	Violation bool `json:"violation" doc:"Whether a violation is recorded against the uploader"`
}

type reportLevelRuleDTO struct {
	Level   report.Level     `json:"level" enum:"LOW,MEDIUM,HIGH,CRITICAL"`
	Penalty reportPenaltyDTO `json:"penalty"`
	Reasons []report.Reason  `json:"reasons" doc:"Reasons whose reports start at this level"`
}

type reportFalseStepDTO struct {
	Count   int `json:"count" doc:"Invalid reports within the window"`
	BanDays int `json:"ban_days"`
}

type reportPolicyDTO struct {
	Levels                 []reportLevelRuleDTO `json:"levels"`
	FalseReportSteps       []reportFalseStepDTO `json:"false_report_steps"`
	FalseReportWindowDays  int                  `json:"false_report_window_days"`
	ViolationFreezeSeconds int64                `json:"violation_freeze_seconds" doc:"How long a violation keeps the uploader one tier down"`
}

func toPolicyDTO(policy report.Policy) reportPolicyDTO {
	levels := make([]reportLevelRuleDTO, len(policy.Levels))
	for i, rule := range policy.Levels {
		levels[i] = reportLevelRuleDTO{Level: rule.Level, Penalty: reportPenaltyDTO(rule.Penalty), Reasons: rule.Reasons}
	}
	steps := make([]reportFalseStepDTO, len(policy.FalseReportSteps))
	for i, step := range policy.FalseReportSteps {
		steps[i] = reportFalseStepDTO(step)
	}
	return reportPolicyDTO{
		Levels:                 levels,
		FalseReportSteps:       steps,
		FalseReportWindowDays:  policy.FalseReportWindowDays,
		ViolationFreezeSeconds: int64(policy.ViolationFreeze.Seconds()),
	}
}

func toGameDTO(t report.GameTitles) reportGameDTO {
	return reportGameDTO{ID: t.ID, TitleJP: t.TitleJP, TitleZH: t.TitleZH, TitleEN: t.TitleEN}
}

func toMemberDTO(m report.Member, now time.Time) reportMemberDTO {
	return reportMemberDTO{UserSummaryDTO: userhttp.ToUserSummary(m.Summary, now), Role: m.Role, Status: m.Status}
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

func toDetailDTO(detail report.Detail, now time.Time) reportDetailDTO {
	v := detail.View
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
		ReporterRecord:         reporterRecordDTO(detail.ReporterRecord),
		ReportedUser:           toMemberDTO(v.ReportedUser, now),
		Processor:              userhttp.ToUserSummaryPtr(v.Processor, now),
	}
}
