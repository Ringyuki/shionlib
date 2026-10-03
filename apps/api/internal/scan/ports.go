package scan

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Repository interface {
	ListPending(ctx context.Context, limit int) ([]PendingFile, error)
	LockFile(ctx context.Context, fileID int) (PendingFile, bool, error)
	SetCheckStatus(ctx context.Context, fileID int, status download.CheckStatus, falsePositive bool) error
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
}

type VirusScanner interface {
	Scan(ctx context.Context, path string) (Report, error)
}

type Files interface {
	RemoveFile(ctx context.Context, fileID int) (download.File, bool, error)
	RemoveEmptyResource(ctx context.Context, resourceID int) error
}

type LocalFiles interface {
	Owns(path string) bool
	Remove(ctx context.Context, path string) error
}

type Quota interface {
	Withdraw(ctx context.Context, userID, sessionID int) error
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
}

type Queue interface {
	Enqueue(ctx context.Context, job download.Job) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}
