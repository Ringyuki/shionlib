package scan

import (
	"encoding/json"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type CaseStatus string

const (
	CasePending  CaseStatus = "PENDING"
	CaseReleased CaseStatus = "RELEASED_FALSE_POSITIVE"
	CaseDeleted  CaseStatus = "DELETED"
)

type DecisionSource string

const (
	SourceAdminAllow        DecisionSource = "ADMIN_ALLOW"
	SourceAdminDelete       DecisionSource = "ADMIN_DELETE"
	SourceTimeoutAutoDelete DecisionSource = "TIMEOUT_AUTO_DELETE"
)

type Decision string

const (
	DecisionAllow  Decision = "ALLOW"
	DecisionDelete Decision = "DELETE"
)

const (
	Detector          = "clamscan"
	expiredCaseBatch  = 20
	pendingFileBatch  = 50
	adminReviewPrefix = "/admin/malware-scans?id="
)

var SortFields = []string{"id", "created", "updated", "reviewed_at", "review_deadline"}

type PendingFile struct {
	ID              int
	ResourceID      int
	GameID          int
	Type            int
	Status          int
	CheckStatus     download.CheckStatus
	Path            string
	Name            string
	Size            int64
	Hash            string
	HashAlgorithm   string
	UploadSessionID *int
	CreatorID       int
}

type Report struct {
	Infected   bool
	Viruses    []string
	Result     json.RawMessage
	LogPath    *string
	LogExcerpt *string
}

type Case struct {
	ID                 int
	FileID             *int
	ResourceID         *int
	GameID             *int
	UploaderID         int
	ReviewedBy         *int
	Status             CaseStatus
	DecisionSource     *DecisionSource
	ReviewNote         *string
	ReviewDeadline     time.Time
	ReviewedAt         *time.Time
	Detector           string
	Viruses            []string
	ScanResult         json.RawMessage
	ScanLogPath        *string
	ScanLogExcerpt     *string
	NotifyOnAllow      bool
	UploaderNotifiedAt *time.Time
	FileName           string
	FileSize           int64
	HashAlgorithm      *string
	FileHash           string
	Created            time.Time
	Updated            time.Time
}

type NewCase struct {
	FileID         int
	ResourceID     int
	GameID         int
	UploaderID     int
	ReviewDeadline time.Time
	Viruses        []string
	ScanResult     json.RawMessage
	ScanLogPath    *string
	ScanLogExcerpt *string
	FileName       string
	FileSize       int64
	FileHash       string
	HashAlgorithm  string
}

type CaseFile struct {
	ID              int
	Type            int
	Status          int
	CheckStatus     int
	FalsePositive   bool
	UploadSessionID *int
	CreatorID       int
	Name            string
	Size            int64
	Path            *string
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
	return "-"
}

type CaseResource struct {
	ID     int
	GameID int
	Note   *string
	Game   GameTitles
}

type Member struct {
	user.Summary
	Role   int
	Status int
}

type CaseView struct {
	Case
	File     *CaseFile
	Resource *CaseResource
	Uploader Member
	Reviewer *user.Summary
}

type Target struct {
	Case
	File           *CaseFile
	ResourceGameID *int
}

func (t Target) GameID() *int {
	if t.Case.GameID != nil && *t.Case.GameID != 0 {
		return t.Case.GameID
	}
	return t.ResourceGameID
}

type Resolution struct {
	Status        CaseStatus
	Source        DecisionSource
	ReviewedBy    *int
	ReviewedAt    time.Time
	Note          *string
	NotifyOnAllow *bool
	NotifiedAt    *time.Time
}

type ReviewInput struct {
	Decision       Decision
	Note           *string
	NotifyUploader *bool
}

type Admin struct {
	ID    int
	Name  string
	Email string
}

type MalwareAlert struct {
	CaseID       int
	FileName     string
	UploaderName string
	GameTitle    string
	Viruses      []string
	Deadline     time.Time
	ReviewURL    string
}

type ListFilter struct {
	Status     *CaseStatus
	Source     *DecisionSource
	FileID     int
	ResourceID int
	UploaderID int
	ReviewerID int
	SortBy     string
	Descending bool
}

type Page = paging.Page

func NormalizeViruses(viruses []string) []string {
	out := make([]string, 0, len(viruses))
	for _, virus := range viruses {
		trimmed := strings.TrimSpace(virus)
		if trimmed != "" && !slices.Contains(out, trimmed) {
			out = append(out, trimmed)
		}
	}
	return out
}
