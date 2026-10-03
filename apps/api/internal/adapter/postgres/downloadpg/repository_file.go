package downloadpg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

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

func (r *Repository) fileQuery(ctx context.Context) *ent.GameDownloadResourceFileQuery {
	return r.db(ctx).GameDownloadResourceFile.Query().WithGameDownloadResource(func(q *ent.GameDownloadResourceQuery) {
		q.Select(gamedownloadresource.FieldID, gamedownloadresource.FieldGameID, gamedownloadresource.FieldStatus)
	})
}
