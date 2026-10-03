package scanhttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type malwareGameDTO struct {
	ID      int    `json:"id"`
	TitleJP string `json:"title_jp"`
	TitleZH string `json:"title_zh"`
	TitleEN string `json:"title_en"`
}

type malwareListFileDTO struct {
	ID                   int  `json:"id"`
	FileStatus           int  `json:"file_status"`
	FileCheckStatus      int  `json:"file_check_status"`
	IsVirusFalsePositive bool `json:"is_virus_false_positive"`
}

type malwareListResourceDTO struct {
	ID     int            `json:"id"`
	GameID int            `json:"game_id"`
	Game   malwareGameDTO `json:"game"`
}

type malwareCaseItemDTO struct {
	ID                    int                      `json:"id"`
	Status                scan.CaseStatus          `json:"status"`
	DecisionSource        *scan.DecisionSource     `json:"decision_source"`
	ReviewNote            *string                  `json:"review_note"`
	ReviewDeadline        time.Time                `json:"review_deadline"`
	ReviewedAt            *time.Time               `json:"reviewed_at"`
	Detector              string                   `json:"detector"`
	DetectedViruses       []string                 `json:"detected_viruses"`
	FileName              string                   `json:"file_name"`
	FileSize              int64                    `json:"file_size"`
	FileHash              string                   `json:"file_hash"`
	HashAlgorithm         *string                  `json:"hash_algorithm"`
	NotifyUploaderOnAllow bool                     `json:"notify_uploader_on_allow"`
	UploaderNotifiedAt    *time.Time               `json:"uploader_notified_at"`
	Created               time.Time                `json:"created"`
	Updated               time.Time                `json:"updated"`
	File                  *malwareListFileDTO      `json:"file"`
	Resource              *malwareListResourceDTO  `json:"resource"`
	Uploader              userhttp.UserSummaryDTO  `json:"uploader"`
	Reviewer              *userhttp.UserSummaryDTO `json:"reviewer"`
}

type malwareDetailFileDTO struct {
	ID                   int  `json:"id"`
	Type                 int  `json:"type"`
	FileStatus           int  `json:"file_status"`
	FileCheckStatus      int  `json:"file_check_status"`
	IsVirusFalsePositive bool `json:"is_virus_false_positive"`
	UploadSessionID      *int `json:"upload_session_id"`
	CreatorID            int  `json:"creator_id"`
}

type malwareDetailResourceDTO struct {
	ID     int            `json:"id"`
	GameID int            `json:"game_id"`
	Note   *string        `json:"note"`
	Game   malwareGameDTO `json:"game"`
}

type malwareMemberDTO struct {
	userhttp.UserSummaryDTO
	Role   int `json:"role"`
	Status int `json:"status"`
}

type malwareCaseDetailDTO struct {
	ID                    int                       `json:"id"`
	Status                scan.CaseStatus           `json:"status"`
	DecisionSource        *scan.DecisionSource      `json:"decision_source"`
	ReviewNote            *string                   `json:"review_note"`
	ReviewDeadline        time.Time                 `json:"review_deadline"`
	ReviewedAt            *time.Time                `json:"reviewed_at"`
	Detector              string                    `json:"detector"`
	DetectedViruses       []string                  `json:"detected_viruses"`
	ScanResult            json.RawMessage           `json:"scan_result"`
	ScanLogPath           *string                   `json:"scan_log_path"`
	ScanLogExcerpt        *string                   `json:"scan_log_excerpt"`
	FileName              string                    `json:"file_name"`
	FileSize              int64                     `json:"file_size"`
	FileHash              string                    `json:"file_hash"`
	HashAlgorithm         *string                   `json:"hash_algorithm"`
	NotifyUploaderOnAllow bool                      `json:"notify_uploader_on_allow"`
	UploaderNotifiedAt    *time.Time                `json:"uploader_notified_at"`
	Created               time.Time                 `json:"created"`
	Updated               time.Time                 `json:"updated"`
	File                  *malwareDetailFileDTO     `json:"file"`
	Resource              *malwareDetailResourceDTO `json:"resource"`
	Uploader              malwareMemberDTO          `json:"uploader"`
	Reviewer              *userhttp.UserSummaryDTO  `json:"reviewer"`
}

func toGame(t scan.GameTitles) malwareGameDTO {
	return malwareGameDTO{ID: t.ID, TitleJP: t.TitleJP, TitleZH: t.TitleZH, TitleEN: t.TitleEN}
}

func viruses(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func toCaseItem(v scan.CaseView, now time.Time) malwareCaseItemDTO {
	out := malwareCaseItemDTO{
		ID:                    v.ID,
		Status:                v.Status,
		DecisionSource:        v.DecisionSource,
		ReviewNote:            v.ReviewNote,
		ReviewDeadline:        v.ReviewDeadline,
		ReviewedAt:            v.ReviewedAt,
		Detector:              v.Detector,
		DetectedViruses:       viruses(v.Viruses),
		FileName:              v.FileName,
		FileSize:              v.FileSize,
		FileHash:              v.FileHash,
		HashAlgorithm:         v.HashAlgorithm,
		NotifyUploaderOnAllow: v.NotifyOnAllow,
		UploaderNotifiedAt:    v.UploaderNotifiedAt,
		Created:               v.Created,
		Updated:               v.Updated,
		Uploader:              userhttp.ToUserSummary(v.Uploader.Summary, now),
		Reviewer:              userhttp.ToUserSummaryPtr(v.Reviewer, now),
	}
	if v.File != nil {
		out.File = &malwareListFileDTO{ID: v.File.ID, FileStatus: v.File.Status, FileCheckStatus: v.File.CheckStatus, IsVirusFalsePositive: v.File.FalsePositive}
	}
	if v.Resource != nil {
		out.Resource = &malwareListResourceDTO{ID: v.Resource.ID, GameID: v.Resource.GameID, Game: toGame(v.Resource.Game)}
	}
	return out
}

func toCaseDetail(v scan.CaseView, now time.Time) malwareCaseDetailDTO {
	out := malwareCaseDetailDTO{
		ID:                    v.ID,
		Status:                v.Status,
		DecisionSource:        v.DecisionSource,
		ReviewNote:            v.ReviewNote,
		ReviewDeadline:        v.ReviewDeadline,
		ReviewedAt:            v.ReviewedAt,
		Detector:              v.Detector,
		DetectedViruses:       viruses(v.Viruses),
		ScanLogPath:           v.ScanLogPath,
		ScanLogExcerpt:        v.ScanLogExcerpt,
		FileName:              v.FileName,
		FileSize:              v.FileSize,
		FileHash:              v.FileHash,
		HashAlgorithm:         v.HashAlgorithm,
		NotifyUploaderOnAllow: v.NotifyOnAllow,
		UploaderNotifiedAt:    v.UploaderNotifiedAt,
		Created:               v.Created,
		Updated:               v.Updated,
		Uploader:              malwareMemberDTO{UserSummaryDTO: userhttp.ToUserSummary(v.Uploader.Summary, now), Role: v.Uploader.Role, Status: v.Uploader.Status},
		Reviewer:              userhttp.ToUserSummaryPtr(v.Reviewer, now),
	}
	if len(v.ScanResult) > 0 {
		out.ScanResult = v.ScanResult
	}
	if v.File != nil {
		out.File = &malwareDetailFileDTO{
			ID:                   v.File.ID,
			Type:                 v.File.Type,
			FileStatus:           v.File.Status,
			FileCheckStatus:      v.File.CheckStatus,
			IsVirusFalsePositive: v.File.FalsePositive,
			UploadSessionID:      v.File.UploadSessionID,
			CreatorID:            v.File.CreatorID,
		}
	}
	if v.Resource != nil {
		out.Resource = &malwareDetailResourceDTO{ID: v.Resource.ID, GameID: v.Resource.GameID, Note: v.Resource.Note, Game: toGame(v.Resource.Game)}
	}
	return out
}
