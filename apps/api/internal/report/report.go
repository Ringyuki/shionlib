package report

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type Reason string

const (
	ReasonMalware           Reason = "MALWARE"
	ReasonIrrelevant        Reason = "IRRELEVANT"
	ReasonBrokenLink        Reason = "BROKEN_LINK"
	ReasonMisleadingContent Reason = "MISLEADING_CONTENT"
	ReasonOther             Reason = "OTHER"
)

type Status string

const (
	StatusPending Status = "PENDING"
	StatusValid   Status = "VALID"
	StatusInvalid Status = "INVALID"
)

type Level string

const (
	LevelLow      Level = "LOW"
	LevelMedium   Level = "MEDIUM"
	LevelHigh     Level = "HIGH"
	LevelCritical Level = "CRITICAL"
)

type Verdict string

const (
	VerdictValid   Verdict = "VALID"
	VerdictInvalid Verdict = "INVALID"
)

const (
	GiB                      int64 = 1 << 30
	FalseReportWindow              = 30 * 24 * time.Hour
	FalseReportWindowDays          = 30
	SuspendThreshold               = 12
	RoleUser                       = 1
	UserBanned                     = 2
	adminReviewPrefix              = "/admin/reports?id="
	falsePositiveQuotaReason       = "REPORT_FALSE_POSITIVE"
)

var SortFields = []string{"id", "created", "updated", "processed_at"}

type Penalty struct {
	QuotaBytes int64
	BanDays    int
}

var defaultLevels = map[Reason]Level{
	ReasonMalware:           LevelCritical,
	ReasonIrrelevant:        LevelMedium,
	ReasonBrokenLink:        LevelLow,
	ReasonMisleadingContent: LevelHigh,
	ReasonOther:             LevelMedium,
}

var targetPenalties = map[Level]Penalty{
	LevelLow:      {},
	LevelMedium:   {QuotaBytes: GiB},
	LevelHigh:     {QuotaBytes: 2 * GiB, BanDays: 7},
	LevelCritical: {QuotaBytes: 5 * GiB, BanDays: 30},
}

func DefaultLevel(reason Reason) Level {
	if level, ok := defaultLevels[reason]; ok {
		return level
	}
	return LevelMedium
}

func TargetPenalty(level Level) Penalty {
	return targetPenalties[level]
}

func FalseReportPenalty(count int) Penalty {
	switch count {
	case 3:
		return Penalty{QuotaBytes: GiB}
	case 5:
		return Penalty{BanDays: 3}
	case 8:
		return Penalty{BanDays: 14}
	default:
		return Penalty{}
	}
}

type Report struct {
	ID                     int
	ResourceID             int
	ReporterID             int
	ReportedUserID         int
	Reason                 Reason
	Detail                 *string
	Status                 Status
	Level                  Level
	ProcessedBy            *int
	ProcessedAt            *time.Time
	ProcessNote            *string
	ReporterPenaltyApplied bool
	ReportedPenaltyApplied bool
	Created                time.Time
	Updated                time.Time
}

type NewReport struct {
	ResourceID     int
	ReporterID     int
	ReportedUserID int
	Reason         Reason
	Detail         *string
	Level          Level
}

type GameTitles struct {
	ID      int
	TitleJP string
	TitleZH string
	TitleEN string
}

func (t GameTitles) Display() string {
	for _, title := range []string{t.TitleZH, t.TitleJP, t.TitleEN} {
		if title != "" {
			return title
		}
	}
	return ""
}

type FileRef struct {
	ID            int
	Name          string
	Size          int64
	Status        int
	CheckStatus   int
	HashAlgorithm upload.HashAlgorithm
	Hash          string
}

type ResourceRef struct {
	ID     int
	GameID int
	Note   *string
	Game   GameTitles
	Files  []FileRef
}

type Member struct {
	user.Summary
	Role   int
	Status int
}

type View struct {
	Report
	Resource     ResourceRef
	Reporter     Member
	ReportedUser Member
	Processor    *user.Summary
}

type Resolution struct {
	Status      Status
	Level       Level
	ProcessedBy int
	ProcessedAt time.Time
	Note        *string
}

type ReviewInput struct {
	Verdict        Verdict
	Level          *Level
	Note           *string
	Notify         *bool
	RemoveResource *bool
}

type CreateInput struct {
	Reason Reason
	Detail *string
}

type Admin struct {
	ID    int
	Name  string
	Email string
}

type ReportAlert struct {
	ReportID         int
	ReporterName     string
	ReportedUserName string
	Reason           Reason
	Level            Level
	GameTitle        string
	Detail           *string
	ReviewURL        string
}

type ListFilter struct {
	Status         *Status
	Reason         *Reason
	Level          *Level
	ResourceID     int
	ReporterID     int
	ReportedUserID int
	SortBy         string
	Descending     bool
}

type Page = paging.Page

func (p penaltyOutcome) applied() bool {
	return p.banApplied || p.quotaBytes > 0
}

type penaltyOutcome struct {
	count      int
	banApplied bool
	banDays    int
	quotaBytes int64
}
