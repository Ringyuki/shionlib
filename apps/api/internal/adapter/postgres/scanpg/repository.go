package scanpg

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
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/malwarescancase"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	roleAdmin      = 2
	userActive     = 1
	defaultSortKey = "created"
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

func (r *Repository) pendingQuery(ctx context.Context) *ent.GameDownloadResourceFileQuery {
	return r.db(ctx).GameDownloadResourceFile.Query().WithGameDownloadResource(func(q *ent.GameDownloadResourceQuery) {
		q.Select(gamedownloadresource.FieldID, gamedownloadresource.FieldGameID)
	})
}

func (r *Repository) ListPending(ctx context.Context, limit int) ([]scan.PendingFile, error) {
	rows, err := r.pendingQuery(ctx).
		Where(
			gamedownloadresourcefile.Type(download.FileTypeObjectStore),
			gamedownloadresourcefile.FileStatus(download.FileOnServer),
			gamedownloadresourcefile.FileCheckStatus(int(download.CheckPending)),
			gamedownloadresourcefile.FilePathNotNil(),
		).
		Order(ent.Asc(gamedownloadresourcefile.FieldID)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list files pending scan: %w", err)
	}
	files := make([]scan.PendingFile, len(rows))
	for i, row := range rows {
		files[i] = toPendingFile(row)
	}
	return files, nil
}

func (r *Repository) LockFile(ctx context.Context, fileID int) (scan.PendingFile, bool, error) {
	row, err := r.pendingQuery(ctx).Where(gamedownloadresourcefile.ID(fileID)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return scan.PendingFile{}, false, nil
	}
	if err != nil {
		return scan.PendingFile{}, false, fmt.Errorf("lock file %d for scan: %w", fileID, err)
	}
	return toPendingFile(row), true, nil
}

func (r *Repository) SetCheckStatus(ctx context.Context, fileID int, status download.CheckStatus, falsePositive bool) error {
	err := r.db(ctx).GameDownloadResourceFile.UpdateOneID(fileID).
		SetFileCheckStatus(int(status)).
		SetIsVirusFalsePositive(falsePositive).
		Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrFileNotFound
	}
	if err != nil {
		return fmt.Errorf("set check status of file %d: %w", fileID, err)
	}
	return nil
}

func (r *Repository) CreateCase(ctx context.Context, in scan.NewCase) (scan.Case, error) {
	create := r.db(ctx).MalwareScanCase.Create().
		SetFileID(in.FileID).
		SetResourceID(in.ResourceID).
		SetGameID(in.GameID).
		SetUploaderID(in.UploaderID).
		SetStatus(malwarescancase.StatusPENDING).
		SetReviewDeadline(in.ReviewDeadline.UTC()).
		SetDetector(scan.Detector).
		SetDetectedViruses(pgvalue.Strings(nonNil(in.Viruses))).
		SetNillableScanLogPath(in.ScanLogPath).
		SetNillableScanLogExcerpt(in.ScanLogExcerpt).
		SetFileName(in.FileName).
		SetFileSize(in.FileSize).
		SetFileHash(in.FileHash)
	if len(in.ScanResult) > 0 {
		create.SetScanResult(in.ScanResult)
	}
	if in.HashAlgorithm != "" {
		create.SetHashAlgorithm(malwarescancase.HashAlgorithm(in.HashAlgorithm))
	}
	row, err := create.Save(ctx)
	if err != nil {
		return scan.Case{}, fmt.Errorf("create malware scan case: %w", err)
	}
	return toCase(row), nil
}

func (r *Repository) LockCase(ctx context.Context, id int) (scan.Target, error) {
	row, err := r.db(ctx).MalwareScanCase.Query().Where(malwarescancase.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return scan.Target{}, scan.ErrCaseNotFound
	}
	if err != nil {
		return scan.Target{}, fmt.Errorf("lock malware scan case %d: %w", id, err)
	}
	target := scan.Target{Case: toCase(row)}
	if row.FileID != nil {
		file, err := r.db(ctx).GameDownloadResourceFile.Get(ctx, *row.FileID)
		if err != nil && !postgres.IsNotFound(err) {
			return scan.Target{}, fmt.Errorf("load file of malware scan case %d: %w", id, err)
		}
		if file != nil {
			target.File = toCaseFile(file)
		}
	}
	if row.ResourceID != nil {
		resource, err := r.db(ctx).GameDownloadResource.Query().
			Where(gamedownloadresource.ID(*row.ResourceID)).
			Select(gamedownloadresource.FieldID, gamedownloadresource.FieldGameID).
			Only(ctx)
		if err != nil && !postgres.IsNotFound(err) {
			return scan.Target{}, fmt.Errorf("load resource of malware scan case %d: %w", id, err)
		}
		if resource != nil {
			gameID := resource.GameID
			target.ResourceGameID = &gameID
		}
	}
	return target, nil
}

func (r *Repository) ResolveCase(ctx context.Context, id int, resolution scan.Resolution) error {
	update := r.db(ctx).MalwareScanCase.UpdateOneID(id).
		SetStatus(malwarescancase.Status(resolution.Status)).
		SetDecisionSource(malwarescancase.DecisionSource(resolution.Source)).
		SetReviewedAt(resolution.ReviewedAt.UTC())
	if resolution.ReviewedBy != nil {
		update.SetReviewedBy(*resolution.ReviewedBy)
	} else {
		update.ClearReviewedBy()
	}
	if resolution.Note != nil {
		update.SetReviewNote(*resolution.Note)
	} else {
		update.ClearReviewNote()
	}
	if resolution.NotifiedAt != nil {
		update.SetUploaderNotifiedAt(resolution.NotifiedAt.UTC())
	} else {
		update.ClearUploaderNotifiedAt()
	}
	if resolution.NotifyOnAllow != nil {
		update.SetNotifyUploaderOnAllow(*resolution.NotifyOnAllow)
	}
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return scan.ErrCaseNotFound
	}
	if err != nil {
		return fmt.Errorf("resolve malware scan case %d: %w", id, err)
	}
	return nil
}

func (r *Repository) ExpiredCases(ctx context.Context, now time.Time, limit int) ([]int, error) {
	ids, err := r.db(ctx).MalwareScanCase.Query().
		Where(malwarescancase.StatusEQ(malwarescancase.StatusPENDING), malwarescancase.ReviewDeadlineLTE(now.UTC())).
		Order(ent.Asc(malwarescancase.FieldReviewDeadline), ent.Asc(malwarescancase.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list expired malware scan cases: %w", err)
	}
	return ids, nil
}

func (r *Repository) ListCases(ctx context.Context, filter scan.ListFilter, page scan.Page) ([]scan.CaseView, int, error) {
	var predicates []predicate.MalwareScanCase
	if filter.Status != nil {
		predicates = append(predicates, malwarescancase.StatusEQ(malwarescancase.Status(*filter.Status)))
	}
	if filter.Source != nil {
		predicates = append(predicates, malwarescancase.DecisionSourceEQ(malwarescancase.DecisionSource(*filter.Source)))
	}
	if filter.FileID != 0 {
		predicates = append(predicates, malwarescancase.FileID(filter.FileID))
	}
	if filter.ResourceID != 0 {
		predicates = append(predicates, malwarescancase.ResourceID(filter.ResourceID))
	}
	if filter.UploaderID != 0 {
		predicates = append(predicates, malwarescancase.UploaderID(filter.UploaderID))
	}
	if filter.ReviewerID != 0 {
		predicates = append(predicates, malwarescancase.ReviewedBy(filter.ReviewerID))
	}
	query := r.db(ctx).MalwareScanCase.Query().Where(predicates...)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count malware scan cases: %w", err)
	}
	sortKey := filter.SortBy
	if !slices.Contains(scan.SortFields, sortKey) {
		sortKey = defaultSortKey
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	rows, err := withView(query).
		Order(order(sortKey), order(malwarescancase.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list malware scan cases: %w", err)
	}
	views := make([]scan.CaseView, len(rows))
	for i, row := range rows {
		views[i] = toView(row)
	}
	return views, total, nil
}

func (r *Repository) GetCase(ctx context.Context, id int) (scan.CaseView, error) {
	row, err := withView(r.db(ctx).MalwareScanCase.Query().Where(malwarescancase.ID(id))).Only(ctx)
	if postgres.IsNotFound(err) {
		return scan.CaseView{}, scan.ErrCaseNotFound
	}
	if err != nil {
		return scan.CaseView{}, fmt.Errorf("get malware scan case %d: %w", id, err)
	}
	return toView(row), nil
}

func (r *Repository) AddStrike(ctx context.Context, userID int) (int, error) {
	rows, err := r.db(ctx).QueryContext(ctx, `UPDATE users SET upload_injected_file_times = upload_injected_file_times + 1, updated = $2 WHERE id = $1 RETURNING upload_injected_file_times`, userID, time.Now().UTC())
	if err != nil {
		return 0, fmt.Errorf("add malware strike to user %d: %w", userID, err)
	}
	defer func() {
		_ = rows.Close()
	}()
	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return 0, fmt.Errorf("add malware strike to user %d: %w", userID, err)
		}
		return 0, fmt.Errorf("add malware strike to user %d: user does not exist", userID)
	}
	var strikes int
	if err := rows.Scan(&strikes); err != nil {
		return 0, fmt.Errorf("read malware strikes of user %d: %w", userID, err)
	}
	return strikes, rows.Err()
}

func (r *Repository) ActiveAdmins(ctx context.Context) ([]scan.Admin, error) {
	rows, err := r.db(ctx).User.Query().
		Where(entuser.RoleGTE(roleAdmin), entuser.Status(userActive)).
		Order(ent.Asc(entuser.FieldID)).
		Select(entuser.FieldID, entuser.FieldName, entuser.FieldEmail).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list active admins: %w", err)
	}
	admins := make([]scan.Admin, len(rows))
	for i, row := range rows {
		admins[i] = scan.Admin{ID: row.ID, Name: row.Name, Email: row.Email}
	}
	return admins, nil
}

func (r *Repository) UserName(ctx context.Context, userID int) (string, bool, error) {
	row, err := r.db(ctx).User.Query().Where(entuser.ID(userID)).Select(entuser.FieldID, entuser.FieldName).Only(ctx)
	if postgres.IsNotFound(err) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("get name of user %d: %w", userID, err)
	}
	return row.Name, true, nil
}

func (r *Repository) GameTitles(ctx context.Context, gameID int) (scan.GameTitles, bool, error) {
	row, err := r.db(ctx).Game.Query().
		Where(entgame.ID(gameID)).
		Select(entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return scan.GameTitles{}, false, nil
	}
	if err != nil {
		return scan.GameTitles{}, false, fmt.Errorf("get titles of game %d: %w", gameID, err)
	}
	return toTitles(row), true, nil
}

func withView(query *ent.MalwareScanCaseQuery) *ent.MalwareScanCaseQuery {
	return query.
		WithFile().
		WithResource(func(q *ent.GameDownloadResourceQuery) {
			q.Select(gamedownloadresource.FieldID, gamedownloadresource.FieldGameID, gamedownloadresource.FieldNote).
				WithGame(func(q *ent.GameQuery) {
					q.Select(entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn)
				})
		}).
		WithUploader(func(q *ent.UserQuery) {
			q.Select(append(slices.Clone(userpg.SummaryFields), entuser.FieldRole, entuser.FieldStatus)...)
		}).
		WithReviewer(userpg.SelectSummary)
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return slices.Clone(values)
}
