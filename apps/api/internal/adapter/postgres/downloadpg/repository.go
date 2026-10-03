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

func (r *Repository) CreateFile(ctx context.Context, in download.NewFile) (download.File, error) {
	row, err := r.db(ctx).GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(in.ResourceID).
		SetType(in.Type).
		SetFileName(in.Name).
		SetNillableFilePath(in.Path).
		SetFileSize(in.Size).
		SetNillableS3FileKey(in.StorageKey).
		SetNillableFileContentType(in.ContentType).
		SetHashAlgorithm(gamedownloadresourcefile.HashAlgorithm(in.HashAlgorithm)).
		SetFileHash(in.Hash).
		SetNillableUploadSessionID(in.UploadSessionID).
		SetFileStatus(in.Status).
		SetCreatorID(in.CreatorID).
		Save(ctx)
	switch {
	case postgres.IsForeignKeyViolation(err, fileResourceFK):
		return download.File{}, download.ErrResourceNotFound
	case postgres.IsForeignKeyViolation(err, fileSessionFK):
		return download.File{}, upload.ErrSessionNotFound
	case postgres.IsUniqueViolation(err, uniqueFileSession), postgres.IsUniqueViolation(err, uniqueFilePath):
		return download.File{}, upload.ErrSessionAlreadyUsed
	case err != nil:
		return download.File{}, fmt.Errorf("create download file: %w", err)
	}
	return r.GetFile(ctx, row.ID)
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

func (r *Repository) ListFiles(ctx context.Context, resourceID int) ([]download.File, error) {
	rows, err := r.fileQuery(ctx).
		Where(gamedownloadresourcefile.GameDownloadResourceID(resourceID)).
		Order(ent.Asc(gamedownloadresourcefile.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list files of download resource %d: %w", resourceID, err)
	}
	return toFiles(rows), nil
}

func (r *Repository) CountFiles(ctx context.Context, resourceID int) (int, error) {
	count, err := r.db(ctx).GameDownloadResourceFile.Query().Where(gamedownloadresourcefile.GameDownloadResourceID(resourceID)).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count files of download resource %d: %w", resourceID, err)
	}
	return count, nil
}

func (r *Repository) GetFile(ctx context.Context, id int) (download.File, error) {
	row, err := r.fileQuery(ctx).Where(gamedownloadresourcefile.ID(id)).Only(ctx)
	if postgres.IsNotFound(err) {
		return download.File{}, download.ErrFileNotFound
	}
	if err != nil {
		return download.File{}, fmt.Errorf("get download file %d: %w", id, err)
	}
	return toFile(row, row.Edges.GameDownloadResource), nil
}

func (r *Repository) LockFile(ctx context.Context, id int) (download.File, error) {
	row, err := r.fileQuery(ctx).Where(gamedownloadresourcefile.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return download.File{}, download.ErrFileNotFound
	}
	if err != nil {
		return download.File{}, fmt.Errorf("lock download file %d: %w", id, err)
	}
	return toFile(row, row.Edges.GameDownloadResource), nil
}

func (r *Repository) FindFileBySession(ctx context.Context, sessionID int) (download.File, bool, error) {
	row, err := r.fileQuery(ctx).Where(gamedownloadresourcefile.UploadSessionID(sessionID)).Only(ctx)
	if postgres.IsNotFound(err) {
		return download.File{}, false, nil
	}
	if err != nil {
		return download.File{}, false, fmt.Errorf("find file of upload session %d: %w", sessionID, err)
	}
	return toFile(row, row.Edges.GameDownloadResource), true, nil
}

func (r *Repository) ReplaceFileContent(ctx context.Context, id int, content download.FileContent) error {
	update := r.db(ctx).GameDownloadResourceFile.UpdateOneID(id).
		SetFilePath(content.Path).
		SetFileSize(content.Size).
		SetFileHash(content.Hash).
		SetHashAlgorithm(gamedownloadresourcefile.HashAlgorithm(content.HashAlgorithm)).
		SetFileStatus(download.FileOnServer).
		SetFileCheckStatus(int(download.CheckPending)).
		SetIsVirusFalsePositive(false).
		ClearS3FileKey().
		SetUploadSessionID(content.UploadSessionID)
	if content.ContentType != nil {
		update.SetFileContentType(*content.ContentType)
	} else {
		update.ClearFileContentType()
	}
	err := update.Exec(ctx)
	switch {
	case postgres.IsNotFound(err):
		return download.ErrFileNotFound
	case postgres.IsUniqueViolation(err, uniqueFileSession), postgres.IsUniqueViolation(err, uniqueFilePath):
		return upload.ErrSessionAlreadyUsed
	case err != nil:
		return fmt.Errorf("replace content of download file %d: %w", id, err)
	}
	return nil
}

func (r *Repository) MarkFileStored(ctx context.Context, id int, key string) error {
	return r.updateFile(ctx, id, "mark stored", func(u *ent.GameDownloadResourceFileUpdateOne) {
		u.SetFileStatus(download.FileInObjectStore).SetS3FileKey(key)
	})
}

func (r *Repository) ClearFilePath(ctx context.Context, id int) error {
	return r.updateFile(ctx, id, "clear path of", func(u *ent.GameDownloadResourceFileUpdateOne) {
		u.ClearFilePath()
	})
}

func (r *Repository) updateFile(ctx context.Context, id int, action string, apply func(*ent.GameDownloadResourceFileUpdateOne)) error {
	update := r.db(ctx).GameDownloadResourceFile.UpdateOneID(id)
	apply(update)
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrFileNotFound
	}
	if err != nil {
		return fmt.Errorf("%s download file %d: %w", action, id, err)
	}
	return nil
}

func (r *Repository) DeleteFile(ctx context.Context, id int) error {
	err := r.db(ctx).GameDownloadResourceFile.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrFileNotFound
	}
	if err != nil {
		return fmt.Errorf("delete download file %d: %w", id, err)
	}
	return nil
}

func (r *Repository) ListStoredWithLocalCopy(ctx context.Context, limit int) ([]download.File, error) {
	rows, err := r.fileQuery(ctx).
		Where(
			gamedownloadresourcefile.Type(download.FileTypeObjectStore),
			gamedownloadresourcefile.FileStatus(download.FileInObjectStore),
			gamedownloadresourcefile.FilePathNotNil(),
		).
		Order(ent.Asc(gamedownloadresourcefile.FieldID)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stored files with local copies: %w", err)
	}
	return toFiles(rows), nil
}

func (r *Repository) ListAwaitingStore(ctx context.Context, updatedBefore time.Time, limit int) ([]int, error) {
	ids, err := r.db(ctx).GameDownloadResourceFile.Query().
		Where(
			gamedownloadresourcefile.Type(download.FileTypeObjectStore),
			gamedownloadresourcefile.FileStatus(download.FileOnServer),
			gamedownloadresourcefile.FileCheckStatus(int(download.CheckOK)),
			gamedownloadresourcefile.FilePathNotNil(),
			gamedownloadresourcefile.UpdatedLT(updatedBefore.UTC()),
		).
		Order(ent.Asc(gamedownloadresourcefile.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list files awaiting object storage: %w", err)
	}
	return ids, nil
}

func (r *Repository) ListRejected(ctx context.Context, limit int) ([]download.File, error) {
	rows, err := r.fileQuery(ctx).
		Where(
			gamedownloadresourcefile.Type(download.FileTypeObjectStore),
			gamedownloadresourcefile.FileStatus(download.FileOnServer),
			gamedownloadresourcefile.FileCheckStatusIn(
				int(download.CheckBrokenOrTruncated),
				int(download.CheckBrokenOrUnsupported),
				int(download.CheckEncrypted),
				int(download.CheckHarmful),
			),
		).
		Order(ent.Asc(gamedownloadresourcefile.FieldID)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list rejected files: %w", err)
	}
	return toFiles(rows), nil
}

func (r *Repository) CreateHistory(ctx context.Context, in download.NewHistory) error {
	err := r.db(ctx).GameDownloadResourceFileHistory.Create().
		SetFileID(in.FileID).
		SetFileSize(in.Size).
		SetHashAlgorithm(gamedownloadresourcefilehistory.HashAlgorithm(in.HashAlgorithm)).
		SetFileHash(in.Hash).
		SetNillableS3FileKey(in.StorageKey).
		SetNillableReason(in.Reason).
		SetNillableUploadSessionID(in.UploadSessionID).
		SetOperatorID(in.OperatorID).
		Exec(ctx)
	if postgres.IsForeignKeyViolation(err, "game_download_resource_file_histories_file_id_fkey") {
		return download.ErrFileNotFound
	}
	if err != nil {
		return fmt.Errorf("create file history: %w", err)
	}
	return nil
}

func (r *Repository) LatestHistory(ctx context.Context, fileID int) (download.History, bool, error) {
	rows, err := r.db(ctx).GameDownloadResourceFileHistory.Query().
		Where(gamedownloadresourcefilehistory.FileID(fileID)).
		Order(ent.Desc(gamedownloadresourcefilehistory.FieldCreated), ent.Desc(gamedownloadresourcefilehistory.FieldID)).
		Limit(1).
		All(ctx)
	if err != nil {
		return download.History{}, false, fmt.Errorf("find latest history of file %d: %w", fileID, err)
	}
	if len(rows) == 0 {
		return download.History{}, false, nil
	}
	return toHistory(rows[0]), true, nil
}

func (r *Repository) SetHistoryStorageKey(ctx context.Context, id int, key string) error {
	err := r.db(ctx).GameDownloadResourceFileHistory.UpdateOneID(id).SetS3FileKey(key).Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrFileNotFound
	}
	if err != nil {
		return fmt.Errorf("set storage key of history %d: %w", id, err)
	}
	return nil
}

func (r *Repository) ListHistory(ctx context.Context, fileID int) ([]download.HistoryEntry, error) {
	rows, err := r.db(ctx).GameDownloadResourceFileHistory.Query().
		Where(gamedownloadresourcefilehistory.FileID(fileID)).
		Order(ent.Desc(gamedownloadresourcefilehistory.FieldCreated), ent.Desc(gamedownloadresourcefilehistory.FieldID)).
		WithOperator(userpg.SelectSummary).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list history of file %d: %w", fileID, err)
	}
	entries := make([]download.HistoryEntry, len(rows))
	for i, row := range rows {
		entries[i] = download.HistoryEntry{History: toHistory(row), Operator: userpg.ToSummary(row.Edges.Operator)}
	}
	return entries, nil
}

func (r *Repository) GetHistory(ctx context.Context, id int) (download.History, error) {
	row, err := r.db(ctx).GameDownloadResourceFileHistory.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return download.History{}, download.ErrFileNotFound
	}
	if err != nil {
		return download.History{}, fmt.Errorf("get file history %d: %w", id, err)
	}
	return toHistory(row), nil
}

func (r *Repository) SetHistoryReason(ctx context.Context, id int, reason *string) error {
	update := r.db(ctx).GameDownloadResourceFileHistory.UpdateOneID(id)
	if reason != nil {
		update.SetReason(*reason)
	} else {
		update.ClearReason()
	}
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrFileNotFound
	}
	if err != nil {
		return fmt.Errorf("set reason of history %d: %w", id, err)
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

func (r *Repository) fileQuery(ctx context.Context) *ent.GameDownloadResourceFileQuery {
	return r.db(ctx).GameDownloadResourceFile.Query().WithGameDownloadResource(func(q *ent.GameDownloadResourceQuery) {
		q.Select(gamedownloadresource.FieldID, gamedownloadresource.FieldGameID, gamedownloadresource.FieldStatus)
	})
}

func toResource(row *ent.GameDownloadResource) download.Resource {
	resource := download.Resource{
		ID:              row.ID,
		GameID:          row.GameID,
		Status:          row.Status,
		Platforms:       nonNilStrings(row.Platform),
		Languages:       nonNilStrings(row.Language),
		Note:            row.Note,
		Downloads:       row.Downloads,
		UploadSessionID: row.UploadSessionID,
		CreatorID:       row.CreatorID,
		Created:         row.Created,
		Updated:         row.Updated,
	}
	if row.Simulator != nil {
		simulator := string(*row.Simulator)
		resource.Simulator = &simulator
	}
	return resource
}

func toFiles(rows []*ent.GameDownloadResourceFile) []download.File {
	files := make([]download.File, len(rows))
	for i, row := range rows {
		files[i] = toFile(row, row.Edges.GameDownloadResource)
	}
	return files
}

func toFile(row *ent.GameDownloadResourceFile, resource *ent.GameDownloadResource) download.File {
	file := download.File{
		ID:              row.ID,
		ResourceID:      row.GameDownloadResourceID,
		Type:            row.Type,
		Name:            row.FileName,
		Path:            row.FilePath,
		Size:            row.FileSize,
		URL:             row.FileURL,
		StorageKey:      row.S3FileKey,
		ContentType:     row.FileContentType,
		HashAlgorithm:   upload.HashAlgorithm(row.HashAlgorithm),
		Hash:            row.FileHash,
		UploadSessionID: row.UploadSessionID,
		Status:          row.FileStatus,
		CheckStatus:     download.CheckStatus(row.FileCheckStatus),
		FalsePositive:   row.IsVirusFalsePositive,
		CreatorID:       row.CreatorID,
		Created:         row.Created,
		Updated:         row.Updated,
	}
	if resource != nil {
		file.GameID = resource.GameID
		file.ResourceStatus = resource.Status
	}
	return file
}

func toHistory(row *ent.GameDownloadResourceFileHistory) download.History {
	return download.History{
		ID:              row.ID,
		FileID:          row.FileID,
		Size:            row.FileSize,
		HashAlgorithm:   upload.HashAlgorithm(row.HashAlgorithm),
		Hash:            row.FileHash,
		StorageKey:      row.S3FileKey,
		Reason:          row.Reason,
		UploadSessionID: row.UploadSessionID,
		OperatorID:      row.OperatorID,
		Created:         row.Created,
	}
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
