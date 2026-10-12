package scan

import (
	"context"
	"io"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Repository interface {
	PendingResources(ctx context.Context, now time.Time) ([]int, error)
	NextUninspected(ctx context.Context, skip []int) (int, bool, error)
	DelayCheck(ctx context.Context, resourceID int, until time.Time) error
	RecordCheckFailure(ctx context.Context, fileID int, failure CheckFailure) error
	ResumeCheck(ctx context.Context, fileID int) error
	StalledFiles(ctx context.Context, since *time.Time, limit int) ([]PendingFile, error)
	StalledEntries(ctx context.Context, limit int) ([]StalledEntry, error)
	ResourceFiles(ctx context.Context, resourceID int) ([]PendingFile, error)
	LockFile(ctx context.Context, fileID int) (PendingFile, bool, error)
	SetCheckStatus(ctx context.Context, fileID int, status download.CheckStatus, falsePositive bool) error
	SetInspection(ctx context.Context, fileID, inspectionID int, sha256 string) error
	CreateCase(ctx context.Context, in NewCase) (Case, error)
	LockCase(ctx context.Context, id int) (Target, error)
	ResolveCase(ctx context.Context, id int, resolution Resolution) error
	ExpiredCases(ctx context.Context, now time.Time, limit int) ([]int, error)
	ListCases(ctx context.Context, filter ListFilter, page Page) ([]CaseView, int, error)
	GetCase(ctx context.Context, id int) (CaseView, error)
	AddStrike(ctx context.Context, userID int) (int, error)
	ActiveAdmins(ctx context.Context) ([]Admin, error)
	UserName(ctx context.Context, userID int) (string, bool, error)
	GameTitles(ctx context.Context, gameID int) (GameTitles, bool, error)
}

type ArchiveTool interface {
	List(ctx context.Context, path string) (ToolRun, error)
	Test(ctx context.Context, path string) (ToolRun, error)
	Extract(ctx context.Context, path, destination string, selection Selection) (ToolRun, error)
}

type NameReader interface {
	LegacyNames(ctx context.Context, path string) (LegacyNames, error)
}

type DiscReader interface {
	Probe(ctx context.Context, path string) (DiscVolume, error)
	Cook(ctx context.Context, path, target string) error
	Sheet(ctx context.Context, path string, imageBytes int64) (DiscSheet, error)
}

type VirusScanner interface {
	Scan(ctx context.Context, name string, content io.Reader) (Report, error)
	MaxSize() int64
	Engine(ctx context.Context) (Engine, error)
}

type Inspections interface {
	Record(ctx context.Context, draft inspection.Draft) (inspection.Recorded, error)
	KeepPreview(ctx context.Context, inspectionID, entryID int, kind inspection.Preview, content io.Reader) error
	Cleared(ctx context.Context, ids []int) error
}

type Objects interface {
	Fetch(ctx context.Context, key, path string) error
}

type Spool interface {
	SpoolRoom(ctx context.Context) (int64, error)
}

type Workspace interface {
	Create(ctx context.Context) (string, error)
	Link(ctx context.Context, source, target string) error
	Files(ctx context.Context, dir string) ([]string, error)
	Open(ctx context.Context, path string) (io.ReadCloser, error)
	Discard(ctx context.Context, dir string) error
}

type Files interface {
	TakeDown(ctx context.Context, resourceID int) ([]string, error)
	PurgeLater(ctx context.Context, keys []string) error
	ReviewCleared(ctx context.Context, resourceID int, fileName string, reviewerID *int) error
}

type Activities interface {
	Record(ctx context.Context, in activity.NewActivity) error
}

type Messenger interface {
	Send(ctx context.Context, in message.NewMessage) error
}

type Banner interface {
	Ban(ctx context.Context, userID int, bannedBy *int, reason string, days int) (bool, error)
}

type AdminMailer interface {
	MalwareDetected(ctx context.Context, recipients []string, alert MalwareAlert) error
	CheckStalled(ctx context.Context, recipients []string, alert StalledAlert) error
}

type Queue interface {
	Enqueue(ctx context.Context, job download.Job) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}
