package report

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Repository interface {
	CountInvalidSince(ctx context.Context, reporterID int, since time.Time) (int, error)
	HasPending(ctx context.Context, resourceID, reporterID int) (bool, error)
	Create(ctx context.Context, in NewReport) (Report, error)
	Lock(ctx context.Context, id int) (Report, error)
	Resolve(ctx context.Context, id int, resolution Resolution) error
	MarkReportedPenalty(ctx context.Context, id int, applied bool) error
	MarkReporterPenalty(ctx context.Context, id int, applied bool) error
	List(ctx context.Context, filter ListFilter, page Page) ([]View, int, error)
	Get(ctx context.Context, id int) (View, error)
	Member(ctx context.Context, userID int) (Member, bool, error)
	ActiveAdmins(ctx context.Context) ([]Admin, error)
}

type Resources interface {
	Resource(ctx context.Context, id int) (download.Resource, error)
	TakeDown(ctx context.Context, resourceID int) ([]string, error)
	PurgeLater(ctx context.Context, keys []string) error
}

type Quota interface {
	AdjustSize(ctx context.Context, userID int, action upload.QuotaAction, amount int64, reason string) (int64, error)
}

type Banner interface {
	Ban(ctx context.Context, userID int, bannedBy *int, reason string, days int) (bool, error)
}

type Messenger interface {
	Send(ctx context.Context, in message.NewMessage) error
}

type AdminMailer interface {
	ReportFiled(ctx context.Context, recipients []string, alert ReportAlert) error
}

type Queue interface {
	Enqueue(ctx context.Context, job download.Job) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}
