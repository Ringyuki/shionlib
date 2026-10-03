package downloadpg

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entfavorite "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/favoriteitem"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefilehistory"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/malwarescancase"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	resourceGameFK        = "game_download_resources_game_id_fkey"
	resourceSessionFK     = "game_download_resources_upload_session_id_fkey"
	fileResourceFK        = "game_download_resource_files_game_download_resource_id_fkey"
	fileSessionFK         = "game_download_resource_files_upload_session_id_fkey"
	uniqueFileSession     = "game_download_resource_files_upload_session_id_key"
	uniqueFilePath        = "game_download_resource_files_file_path_key"
	recentHistoryPerFile  = 2
	statusUploadingString = gameuploadsession.StatusUPLOADING
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

func (r *Repository) ListGameResources(ctx context.Context, gameID int) ([]download.GameResource, error) {
	rows, err := r.db(ctx).GameDownloadResource.Query().
		Where(gamedownloadresource.GameID(gameID), gamedownloadresource.Status(download.ResourceActive)).
		Order(ent.Asc(gamedownloadresource.FieldID)).
		WithCreator(userpg.SelectSummary).
		WithFiles(func(q *ent.GameDownloadResourceFileQuery) {
			q.Order(ent.Asc(gamedownloadresourcefile.FieldID)).
				WithCreator(userpg.SelectSummary).
				WithMalwareScanCases(func(q *ent.MalwareScanCaseQuery) {
					q.Select(malwarescancase.FieldID, malwarescancase.FieldDetectedViruses, malwarescancase.FieldFileID).
						Order(ent.Asc(malwarescancase.FieldID))
				})
		}).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list download resources of game %d: %w", gameID, err)
	}
	var fileIDs []int
	for _, row := range rows {
		for _, file := range row.Edges.Files {
			fileIDs = append(fileIDs, file.ID)
		}
	}
	recent, err := r.recentHistory(ctx, fileIDs)
	if err != nil {
		return nil, err
	}
	resources := make([]download.GameResource, len(rows))
	for i, row := range rows {
		resource := download.GameResource{
			Resource: toResource(row),
			Creator:  userpg.ToSummary(row.Edges.Creator),
			Files:    make([]download.GameFile, len(row.Edges.Files)),
		}
		for j, file := range row.Edges.Files {
			cases := make([]download.MalwareCaseRef, len(file.Edges.MalwareScanCases))
			for k, scanCase := range file.Edges.MalwareScanCases {
				cases[k] = download.MalwareCaseRef{ID: scanCase.ID, Viruses: nonNilStrings(scanCase.DetectedViruses)}
			}
			history := recent[file.ID]
			if history == nil {
				history = []download.HistoryRef{}
			}
			resource.Files[j] = download.GameFile{
				File:          toFile(file, row),
				MalwareCases:  cases,
				Creator:       userpg.ToSummary(file.Edges.Creator),
				RecentHistory: history,
			}
		}
		resources[i] = resource
	}
	return resources, nil
}

func (r *Repository) recentHistory(ctx context.Context, fileIDs []int) (map[int][]download.HistoryRef, error) {
	recent := map[int][]download.HistoryRef{}
	if len(fileIDs) == 0 {
		return recent, nil
	}
	rows, err := r.db(ctx).GameDownloadResourceFileHistory.Query().
		Where(gamedownloadresourcefilehistory.FileIDIn(fileIDs...)).
		Select(
			gamedownloadresourcefilehistory.FieldID,
			gamedownloadresourcefilehistory.FieldFileID,
			gamedownloadresourcefilehistory.FieldReason,
			gamedownloadresourcefilehistory.FieldCreated,
			gamedownloadresourcefilehistory.FieldOperatorID,
		).
		Order(ent.Desc(gamedownloadresourcefilehistory.FieldCreated), ent.Desc(gamedownloadresourcefilehistory.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list recent file history: %w", err)
	}
	for _, row := range rows {
		if len(recent[row.FileID]) >= recentHistoryPerFile {
			continue
		}
		recent[row.FileID] = append(recent[row.FileID], download.HistoryRef{ID: row.ID, Reason: row.Reason, Created: row.Created, OperatorID: row.OperatorID})
	}
	return recent, nil
}

func (r *Repository) ListReleases(ctx context.Context, excludeRated bool, page download.Page) ([]download.Release, int, error) {
	rows, total, err := r.listListed(ctx, excludeRated, page)
	if err != nil {
		return nil, 0, fmt.Errorf("list releases: %w", err)
	}
	releases := make([]download.Release, len(rows))
	for i, row := range rows {
		names := fileNames(row.Edges.Files)
		releases[i] = download.Release{Resource: toResource(row), FileNames: names, FilesCount: len(names), Creator: userpg.ToSummary(row.Edges.Creator)}
	}
	return releases, total, nil
}

func (r *Repository) ListUserResources(ctx context.Context, creatorID int, excludeRated bool, page download.Page) ([]download.UserResource, int, error) {
	rows, total, err := r.listListed(ctx, excludeRated, page, gamedownloadresource.CreatorID(creatorID))
	if err != nil {
		return nil, 0, fmt.Errorf("list resources of user %d: %w", creatorID, err)
	}
	items := make([]download.UserResource, len(rows))
	for i, row := range rows {
		names := fileNames(row.Edges.Files)
		items[i] = download.UserResource{Resource: toResource(row), FileNames: names, FilesCount: len(names), Creator: userpg.ToSummary(row.Edges.Creator)}
	}
	return items, total, nil
}

func (r *Repository) listListed(ctx context.Context, excludeRated bool, page download.Page, extra ...predicate.GameDownloadResource) ([]*ent.GameDownloadResource, int, error) {
	predicates := append([]predicate.GameDownloadResource{gamedownloadresource.Status(download.ResourceActive)}, extra...)
	if excludeRated {
		predicates = append(predicates, gamedownloadresource.HasGameWith(gamepg.SafeForStrictViewers()))
	}
	query := r.db(ctx).GameDownloadResource.Query().Where(predicates...)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, err
	}
	rows, err := query.
		Order(ent.Desc(gamedownloadresource.FieldCreated), ent.Desc(gamedownloadresource.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		WithCreator(userpg.SelectSummary).
		WithFiles(func(q *ent.GameDownloadResourceFileQuery) {
			q.Select(gamedownloadresourcefile.FieldID, gamedownloadresourcefile.FieldFileName, gamedownloadresourcefile.FieldGameDownloadResourceID).
				Order(ent.Asc(gamedownloadresourcefile.FieldID))
		}).
		All(ctx)
	if err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *Repository) HasUploadingSession(ctx context.Context, userID int) (bool, error) {
	exists, err := r.db(ctx).GameUploadSession.Query().
		Where(gameuploadsession.CreatorID(userID), gameuploadsession.StatusEQ(statusUploadingString)).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check uploading sessions of user %d: %w", userID, err)
	}
	return exists, nil
}

func (r *Repository) ResourceUsesSession(ctx context.Context, gameID, sessionID int) (bool, error) {
	exists, err := r.db(ctx).GameDownloadResource.Query().
		Where(gamedownloadresource.GameID(gameID), gamedownloadresource.UploadSessionID(sessionID)).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check resource of upload session %d: %w", sessionID, err)
	}
	return exists, nil
}

func (r *Repository) CreateResource(ctx context.Context, in download.NewResource) (download.Resource, error) {
	create := r.db(ctx).GameDownloadResource.Create().
		SetGameID(in.GameID).
		SetPlatform(textArray(in.Platforms)).
		SetLanguage(textArray(in.Languages)).
		SetNillableNote(in.Note).
		SetNillableUploadSessionID(in.UploadSessionID).
		SetCreatorID(in.CreatorID)
	if in.Simulator != nil {
		create.SetSimulator(gamedownloadresource.Simulator(*in.Simulator))
	}
	row, err := create.Save(ctx)
	switch {
	case postgres.IsForeignKeyViolation(err, resourceGameFK):
		return download.Resource{}, game.ErrNotFound
	case postgres.IsForeignKeyViolation(err, resourceSessionFK):
		return download.Resource{}, upload.ErrSessionNotFound
	case err != nil:
		return download.Resource{}, fmt.Errorf("create download resource: %w", err)
	}
	return toResource(row), nil
}

func (r *Repository) GetResource(ctx context.Context, id int) (download.Resource, error) {
	row, err := r.db(ctx).GameDownloadResource.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return download.Resource{}, download.ErrResourceNotFound
	}
	if err != nil {
		return download.Resource{}, fmt.Errorf("get download resource %d: %w", id, err)
	}
	return toResource(row), nil
}

func (r *Repository) LockResource(ctx context.Context, id int) (download.Resource, error) {
	row, err := r.db(ctx).GameDownloadResource.Query().Where(gamedownloadresource.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return download.Resource{}, download.ErrResourceNotFound
	}
	if err != nil {
		return download.Resource{}, fmt.Errorf("lock download resource %d: %w", id, err)
	}
	return toResource(row), nil
}

func (r *Repository) UpdateResource(ctx context.Context, id int, changes download.ResourceChanges) error {
	current, err := r.db(ctx).GameDownloadResource.Query().Where(gamedownloadresource.ID(id)).Select(gamedownloadresource.FieldUpdated).Only(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("read download resource %d: %w", id, err)
	}
	update := r.db(ctx).GameDownloadResource.UpdateOneID(id).
		SetPlatform(textArray(changes.Platforms)).
		SetLanguage(textArray(changes.Languages)).
		SetUpdated(current.Updated)
	if changes.Simulator != nil {
		update.SetSimulator(gamedownloadresource.Simulator(*changes.Simulator))
	} else {
		update.ClearSimulator()
	}
	if changes.Note != nil {
		update.SetNote(*changes.Note)
	}
	if err := update.Exec(ctx); err != nil {
		return fmt.Errorf("update download resource %d: %w", id, err)
	}
	if changes.FileName == nil {
		return nil
	}
	err = r.db(ctx).GameDownloadResourceFile.Update().
		Where(gamedownloadresourcefile.GameDownloadResourceID(id)).
		SetFileName(*changes.FileName).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("rename files of download resource %d: %w", id, err)
	}
	return nil
}

func (r *Repository) SetResourceStatus(ctx context.Context, id, status int, updated time.Time) error {
	err := r.db(ctx).GameDownloadResource.UpdateOneID(id).SetStatus(status).SetUpdated(updated.UTC()).Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("set download resource %d status: %w", id, err)
	}
	return nil
}

func (r *Repository) TouchResource(ctx context.Context, id int, updated time.Time) error {
	err := r.db(ctx).GameDownloadResource.UpdateOneID(id).SetUpdated(updated.UTC()).Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("touch download resource %d: %w", id, err)
	}
	return nil
}

func (r *Repository) DeleteResource(ctx context.Context, id int) error {
	err := r.db(ctx).GameDownloadResource.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("delete download resource %d: %w", id, err)
	}
	return nil
}

func (r *Repository) CountDownload(ctx context.Context, resourceID, gameID int) error {
	result, err := r.db(ctx).ExecContext(ctx, `UPDATE game_download_resources SET downloads = downloads + 1 WHERE id = $1`, resourceID)
	if err != nil {
		return fmt.Errorf("count download of resource %d: %w", resourceID, err)
	}
	if affected, err := result.RowsAffected(); err == nil && affected == 0 {
		return download.ErrResourceNotFound
	}
	if _, err := r.db(ctx).ExecContext(ctx, `UPDATE games SET downloads = downloads + 1, updated = $2 WHERE id = $1`, gameID, time.Now().UTC()); err != nil {
		return fmt.Errorf("count download of game %d: %w", gameID, err)
	}
	return nil
}

func (r *Repository) FavoriteReceivers(ctx context.Context, gameID, excludeUserID int) ([]int, error) {
	ids, err := r.db(ctx).Favorite.Query().
		Where(entfavorite.HasItemsWith(favoriteitem.GameID(gameID)), entfavorite.UserIDNEQ(excludeUserID)).
		Unique(true).
		Order(ent.Asc(entfavorite.FieldUserID)).
		Select(entfavorite.FieldUserID).
		Ints(ctx)
	if err != nil {
		return nil, fmt.Errorf("list users favoriting game %d: %w", gameID, err)
	}
	return slices.Compact(ids), nil
}

func (r *Repository) ResetMalwareStrikes(ctx context.Context, userID int) error {
	if err := r.db(ctx).User.UpdateOneID(userID).SetUploadInjectedFileTimes(0).Exec(ctx); err != nil && !postgres.IsNotFound(err) {
		return fmt.Errorf("reset malware strikes of user %d: %w", userID, err)
	}
	return nil
}

func fileNames(files []*ent.GameDownloadResourceFile) []string {
	names := make([]string, len(files))
	for i, file := range files {
		names[i] = file.FileName
	}
	return names
}

func textArray(values []string) pgvalue.Strings {
	if values == nil {
		return pgvalue.Strings{}
	}
	return pgvalue.Strings(slices.Clone(values))
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return slices.Clone(values)
}
