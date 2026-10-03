package reportpg

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	entreport "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcereport"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
)

const (
	roleAdmin      = 2
	userActive     = 1
	defaultSortKey = "created"
	listedFiles    = 5
	resourceFK     = "game_download_resource_reports_resource_id_fkey"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) CountInvalidSince(ctx context.Context, reporterID int, since time.Time) (int, error) {
	count, err := r.db(ctx).GameDownloadResourceReport.Query().
		Where(
			entreport.ReporterID(reporterID),
			entreport.StatusEQ(entreport.StatusINVALID),
			entreport.CreatedGTE(since.UTC()),
		).
		Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count invalid reports of user %d: %w", reporterID, err)
	}
	return count, nil
}

func (r *Repository) HasPending(ctx context.Context, resourceID, reporterID int) (bool, error) {
	exists, err := r.db(ctx).GameDownloadResourceReport.Query().
		Where(
			entreport.ResourceID(resourceID),
			entreport.ReporterID(reporterID),
			entreport.StatusEQ(entreport.StatusPENDING),
		).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check pending report: %w", err)
	}
	return exists, nil
}

func (r *Repository) Create(ctx context.Context, in report.NewReport) (report.Report, error) {
	row, err := r.db(ctx).GameDownloadResourceReport.Create().
		SetResourceID(in.ResourceID).
		SetReporterID(in.ReporterID).
		SetReportedUserID(in.ReportedUserID).
		SetReason(entreport.Reason(in.Reason)).
		SetNillableDetail(in.Detail).
		SetStatus(entreport.StatusPENDING).
		SetMaliciousLevel(entreport.MaliciousLevel(in.Level)).
		Save(ctx)
	if postgres.IsForeignKeyViolation(err, resourceFK) {
		return report.Report{}, download.ErrResourceNotFound
	}
	if err != nil {
		return report.Report{}, fmt.Errorf("create download resource report: %w", err)
	}
	return toReport(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (report.Report, error) {
	row, err := r.db(ctx).GameDownloadResourceReport.Query().Where(entreport.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return report.Report{}, report.ErrNotFound
	}
	if err != nil {
		return report.Report{}, fmt.Errorf("lock download resource report %d: %w", id, err)
	}
	return toReport(row), nil
}

func (r *Repository) Resolve(ctx context.Context, id int, resolution report.Resolution) error {
	update := r.db(ctx).GameDownloadResourceReport.UpdateOneID(id).
		SetStatus(entreport.Status(resolution.Status)).
		SetMaliciousLevel(entreport.MaliciousLevel(resolution.Level)).
		SetProcessedBy(resolution.ProcessedBy).
		SetProcessedAt(resolution.ProcessedAt.UTC())
	if resolution.Note != nil {
		update.SetProcessNote(*resolution.Note)
	} else {
		update.ClearProcessNote()
	}
	return r.exec(ctx, update, id, "resolve")
}

func (r *Repository) MarkReportedPenalty(ctx context.Context, id int, applied bool) error {
	return r.exec(ctx, r.db(ctx).GameDownloadResourceReport.UpdateOneID(id).SetReportedPenaltyApplied(applied), id, "mark reported penalty on")
}

func (r *Repository) MarkReporterPenalty(ctx context.Context, id int, applied bool) error {
	return r.exec(ctx, r.db(ctx).GameDownloadResourceReport.UpdateOneID(id).SetReporterPenaltyApplied(applied), id, "mark reporter penalty on")
}

func (r *Repository) exec(ctx context.Context, update *ent.GameDownloadResourceReportUpdateOne, id int, action string) error {
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return report.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("%s download resource report %d: %w", action, id, err)
	}
	return nil
}

func (r *Repository) List(ctx context.Context, filter report.ListFilter, page report.Page) ([]report.View, int, error) {
	var predicates []predicate.GameDownloadResourceReport
	if filter.Status != nil {
		predicates = append(predicates, entreport.StatusEQ(entreport.Status(*filter.Status)))
	}
	if filter.Reason != nil {
		predicates = append(predicates, entreport.ReasonEQ(entreport.Reason(*filter.Reason)))
	}
	if filter.Level != nil {
		predicates = append(predicates, entreport.MaliciousLevelEQ(entreport.MaliciousLevel(*filter.Level)))
	}
	if filter.ResourceID != 0 {
		predicates = append(predicates, entreport.ResourceID(filter.ResourceID))
	}
	if filter.ReporterID != 0 {
		predicates = append(predicates, entreport.ReporterID(filter.ReporterID))
	}
	if filter.ReportedUserID != 0 {
		predicates = append(predicates, entreport.ReportedUserID(filter.ReportedUserID))
	}
	query := r.db(ctx).GameDownloadResourceReport.Query().Where(predicates...)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count download resource reports: %w", err)
	}
	sortKey := filter.SortBy
	if !slices.Contains(report.SortFields, sortKey) {
		sortKey = defaultSortKey
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	rows, err := withView(query).
		Order(order(sortKey), order(entreport.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list download resource reports: %w", err)
	}
	views := make([]report.View, len(rows))
	for i, row := range rows {
		view := toView(row)
		if len(view.Resource.Files) > listedFiles {
			view.Resource.Files = view.Resource.Files[:listedFiles]
		}
		views[i] = view
	}
	return views, total, nil
}

func (r *Repository) Get(ctx context.Context, id int) (report.View, error) {
	row, err := withView(r.db(ctx).GameDownloadResourceReport.Query().Where(entreport.ID(id))).Only(ctx)
	if postgres.IsNotFound(err) {
		return report.View{}, report.ErrNotFound
	}
	if err != nil {
		return report.View{}, fmt.Errorf("get download resource report %d: %w", id, err)
	}
	return toView(row), nil
}

func (r *Repository) Member(ctx context.Context, userID int) (report.Member, bool, error) {
	row, err := r.db(ctx).User.Query().Where(entuser.ID(userID)).Select(memberFields()...).Only(ctx)
	if postgres.IsNotFound(err) {
		return report.Member{}, false, nil
	}
	if err != nil {
		return report.Member{}, false, fmt.Errorf("get member %d: %w", userID, err)
	}
	return toMember(row), true, nil
}

func (r *Repository) ActiveAdmins(ctx context.Context) ([]report.Admin, error) {
	rows, err := r.db(ctx).User.Query().
		Where(entuser.RoleGTE(roleAdmin), entuser.Status(userActive)).
		Order(ent.Asc(entuser.FieldID)).
		Select(entuser.FieldID, entuser.FieldName, entuser.FieldEmail).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list active admins: %w", err)
	}
	admins := make([]report.Admin, len(rows))
	for i, row := range rows {
		admins[i] = report.Admin{ID: row.ID, Name: row.Name, Email: row.Email}
	}
	return admins, nil
}

func withView(query *ent.GameDownloadResourceReportQuery) *ent.GameDownloadResourceReportQuery {
	members := func(q *ent.UserQuery) {
		q.Select(memberFields()...)
	}
	return query.
		WithResource(func(q *ent.GameDownloadResourceQuery) {
			q.Select(gamedownloadresource.FieldID, gamedownloadresource.FieldGameID, gamedownloadresource.FieldNote).
				WithGame(func(q *ent.GameQuery) {
					q.Select(entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn)
				}).
				WithFiles(func(q *ent.GameDownloadResourceFileQuery) {
					q.Select(
						gamedownloadresourcefile.FieldID,
						gamedownloadresourcefile.FieldFileName,
						gamedownloadresourcefile.FieldFileSize,
						gamedownloadresourcefile.FieldFileStatus,
						gamedownloadresourcefile.FieldFileCheckStatus,
						gamedownloadresourcefile.FieldHashAlgorithm,
						gamedownloadresourcefile.FieldFileHash,
						gamedownloadresourcefile.FieldGameDownloadResourceID,
					).Order(ent.Asc(gamedownloadresourcefile.FieldID))
				})
		}).
		WithReporter(members).
		WithReportedUser(members).
		WithProcessor(userpg.SelectSummary)
}

func memberFields() []string {
	return append(slices.Clone(userpg.SummaryFields), entuser.FieldRole, entuser.FieldStatus)
}
