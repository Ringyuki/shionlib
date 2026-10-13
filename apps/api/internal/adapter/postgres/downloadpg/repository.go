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
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcetranslator"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/malwarescancase"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

const (
	resourceGameFK        = "game_download_resources_game_id_fkey"
	creditTranslatorFK    = "game_download_resource_translators_translator_id_fkey"
	fileResourceFK        = "game_download_resource_files_game_download_resource_id_fkey"
	fileSessionFK         = "game_download_resource_files_upload_session_id_fkey"
	uniqueFileSession     = "game_download_resource_files_upload_session_id_key"
	uniqueFilePath        = "game_download_resource_files_file_path_key"
	uniqueFileName        = "game_download_resource_files_resource_file_name_key"
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
	rows, err := withFileDetails(r.db(ctx).GameDownloadResource.Query().
		Where(gamedownloadresource.GameID(gameID), gamepg.ActiveResource()).
		Order(ent.Asc(gamedownloadresource.FieldID))).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list download resources of game %d: %w", gameID, err)
	}
	return r.gameResources(ctx, rows)
}

func creditedTranslators(q *ent.GameDownloadResourceTranslatorQuery) {
	q.Order(ent.Asc(gamedownloadresourcetranslator.FieldPosition), ent.Asc(gamedownloadresourcetranslator.FieldID)).WithTranslator()
}

func withFileDetails(query *ent.GameDownloadResourceQuery) *ent.GameDownloadResourceQuery {
	return query.
		WithCreator(userpg.SelectSummary).
		WithTranslatorCredits(creditedTranslators).
		WithFiles(func(q *ent.GameDownloadResourceFileQuery) {
			q.Order(ent.Asc(gamedownloadresourcefile.FieldID)).
				WithCreator(userpg.SelectSummary).
				WithMalwareScanCases(func(q *ent.MalwareScanCaseQuery) {
					q.Select(malwarescancase.FieldID, malwarescancase.FieldDetectedViruses, malwarescancase.FieldFileID).
						Order(ent.Asc(malwarescancase.FieldID))
				})
		})
}

func (r *Repository) gameResources(ctx context.Context, rows []*ent.GameDownloadResource) ([]download.GameResource, error) {
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
		resource.Files = download.Arranged(resource.Files, func(file download.GameFile) string { return file.Name })
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
	order := []gamedownloadresource.OrderOption{ent.Desc(gamedownloadresource.FieldPublishedAt), ent.Desc(gamedownloadresource.FieldID)}
	rows, total, err := r.listListed(ctx, excludeRated, page, order, gamepg.PublicResource())
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

func (r *Repository) ListUserResources(ctx context.Context, creatorID int, filter download.UserResourceFilter, page download.Page) ([]download.UserResource, int, error) {
	predicates := []predicate.GameDownloadResource{gamedownloadresource.CreatorID(creatorID)}
	if !filter.IncludeUnpublished {
		predicates = append(predicates, gamepg.PublicResource())
	}
	order := []gamedownloadresource.OrderOption{ent.Desc(gamedownloadresource.FieldCreated), ent.Desc(gamedownloadresource.FieldID)}
	rows, total, err := r.listListed(ctx, filter.ExcludeRated, page, order, predicates...)
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

func (r *Repository) listListed(ctx context.Context, excludeRated bool, page download.Page, order []gamedownloadresource.OrderOption, extra ...predicate.GameDownloadResource) ([]*ent.GameDownloadResource, int, error) {
	predicates := append([]predicate.GameDownloadResource{gamepg.ActiveResource()}, extra...)
	if excludeRated {
		predicates = append(predicates, gamedownloadresource.HasGameWith(gamepg.SafeForStrictViewers()))
	}
	query := r.db(ctx).GameDownloadResource.Query().Where(predicates...)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, err
	}
	rows, err := query.
		Order(order...).
		Offset(page.Offset()).
		Limit(page.Size).
		WithCreator(userpg.SelectSummary).
		WithTranslatorCredits(creditedTranslators).
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

func (r *Repository) CreateResource(ctx context.Context, in download.NewResource) (download.Resource, error) {
	create := r.db(ctx).GameDownloadResource.Create().
		SetGameID(in.GameID).
		SetPlatform(textArray(in.Platforms)).
		SetLanguage(textArray(in.Languages)).
		SetNillableNote(in.Note).
		SetNillableTranslation((*string)(in.Info.Translation)).
		SetNillablePatchVersion(in.Info.PatchVersion).
		SetNillableReleaseURL(in.Info.ReleaseURL).
		SetNillableEdition((*string)(in.Info.Edition)).
		SetNillableEditionName(in.Info.EditionName).
		SetNillableForm((*string)(in.Info.Form)).
		SetExtras(textArray(in.Info.Extras)).
		SetCreatorID(in.CreatorID)
	if in.Simulator != nil {
		create.SetSimulator(gamedownloadresource.Simulator(*in.Simulator))
	}
	row, err := create.Save(ctx)
	switch {
	case postgres.IsForeignKeyViolation(err, resourceGameFK):
		return download.Resource{}, game.ErrNotFound
	case err != nil:
		return download.Resource{}, fmt.Errorf("create download resource: %w", err)
	}
	if err := r.credit(ctx, row.ID, in.Info.Translators); err != nil {
		return download.Resource{}, err
	}
	resource := toResource(row)
	resource.Info.Translators = append(resource.Info.Translators, in.Info.Translators...)
	return resource, nil
}

func (r *Repository) credit(ctx context.Context, resourceID int, translators []translator.Ref) error {
	return credit(ctx, r.db(ctx), resourceID, translators)
}

func credit(ctx context.Context, db *ent.Client, resourceID int, translators []translator.Ref) error {
	if len(translators) == 0 {
		return nil
	}
	builders := make([]*ent.GameDownloadResourceTranslatorCreate, len(translators))
	for position, credited := range translators {
		builders[position] = db.GameDownloadResourceTranslator.Create().SetResourceID(resourceID).SetTranslatorID(credited.ID).SetPosition(position)
	}
	err := db.GameDownloadResourceTranslator.CreateBulk(builders...).Exec(ctx)
	switch {
	case postgres.IsForeignKeyViolation(err, creditTranslatorFK):
		return translator.ErrNotFound
	case err != nil:
		return fmt.Errorf("credit translators of download resource %d: %w", resourceID, err)
	}
	return nil
}

func (r *Repository) resource(ctx context.Context, id int, lock bool) (download.Resource, error) {
	query := r.db(ctx).GameDownloadResource.Query().Where(gamedownloadresource.ID(id)).WithTranslatorCredits(creditedTranslators)
	if lock {
		query = query.ForUpdate()
	}
	row, err := query.Only(ctx)
	if postgres.IsNotFound(err) {
		return download.Resource{}, download.ErrResourceNotFound
	}
	if err != nil {
		return download.Resource{}, fmt.Errorf("read download resource %d: %w", id, err)
	}
	return toResource(row), nil
}

func (r *Repository) GetResource(ctx context.Context, id int) (download.Resource, error) {
	return r.resource(ctx, id, false)
}

func (r *Repository) LockResource(ctx context.Context, id int) (download.Resource, error) {
	return r.resource(ctx, id, true)
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
	info := changes.Info
	setOrClear(info.Translation != nil, func() { update.SetTranslation(string(*info.Translation)) }, func() { update.ClearTranslation() })
	setOrClear(info.PatchVersion != nil, func() { update.SetPatchVersion(*info.PatchVersion) }, func() { update.ClearPatchVersion() })
	setOrClear(info.ReleaseURL != nil, func() { update.SetReleaseURL(*info.ReleaseURL) }, func() { update.ClearReleaseURL() })
	setOrClear(info.Edition != nil, func() { update.SetEdition(string(*info.Edition)) }, func() { update.ClearEdition() })
	setOrClear(info.EditionName != nil, func() { update.SetEditionName(*info.EditionName) }, func() { update.ClearEditionName() })
	setOrClear(info.Form != nil, func() { update.SetForm(string(*info.Form)) }, func() { update.ClearForm() })
	update.SetExtras(textArray(info.Extras))
	if err := update.Exec(ctx); err != nil {
		return fmt.Errorf("update download resource %d: %w", id, err)
	}
	if _, err := r.db(ctx).GameDownloadResourceTranslator.Delete().Where(gamedownloadresourcetranslator.ResourceID(id)).Exec(ctx); err != nil {
		return fmt.Errorf("clear translators of download resource %d: %w", id, err)
	}
	return r.credit(ctx, id, info.Translators)
}

func (r *Repository) SetForm(ctx context.Context, id int, form download.Form) error {
	current, err := r.db(ctx).GameDownloadResource.Query().Where(gamedownloadresource.ID(id)).Select(gamedownloadresource.FieldUpdated).Only(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("read download resource %d: %w", id, err)
	}
	if err := r.db(ctx).GameDownloadResource.UpdateOneID(id).SetForm(string(form)).SetUpdated(current.Updated).Exec(ctx); err != nil {
		return fmt.Errorf("set the form of download resource %d: %w", id, err)
	}
	return nil
}

func setOrClear(present bool, set, clear func()) {
	if present {
		set()
		return
	}
	clear()
}

func (r *Repository) PublishIfReady(ctx context.Context, id int, at time.Time) (bool, error) {
	published, err := r.db(ctx).GameDownloadResource.Update().
		Where(
			gamedownloadresource.ID(id),
			gamedownloadresource.Status(download.ResourceActive),
			gamedownloadresource.PublishedAtIsNil(),
			gamedownloadresource.HasFiles(),
			gamedownloadresource.Not(gamedownloadresource.HasFilesWith(gamedownloadresourcefile.FileStatusNEQ(download.FileInObjectStore))),
		).
		SetPublishedAt(at.UTC()).
		Save(ctx)
	if err != nil {
		return false, fmt.Errorf("publish download resource %d: %w", id, err)
	}
	return published > 0, nil
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
	if err := r.retireSessions(ctx, "game_download_resource_id", id); err != nil {
		return err
	}
	err := r.db(ctx).GameDownloadResource.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("delete download resource %d: %w", id, err)
	}
	return nil
}

func (r *Repository) retireSessions(ctx context.Context, column string, value int) error {
	query := fmt.Sprintf(`UPDATE game_upload_sessions SET status = 'EXPIRED', updated = $2
WHERE status = 'COMPLETED' AND id IN (SELECT upload_session_id FROM game_download_resource_files WHERE %s = $1)`, column)
	if _, err := r.db(ctx).ExecContext(ctx, query, value, time.Now().UTC()); err != nil {
		return fmt.Errorf("retire upload sessions of %s %d: %w", column, value, err)
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
	now := time.Now()
	if _, err := r.db(ctx).ExecContext(ctx, `UPDATE games SET downloads = downloads + 1, updated = $2 WHERE id = $1`, gameID, now.UTC()); err != nil {
		return fmt.Errorf("count download of game %d: %w", gameID, err)
	}
	return postgres.CountDailyDownload(ctx, r.db(ctx), now)
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
