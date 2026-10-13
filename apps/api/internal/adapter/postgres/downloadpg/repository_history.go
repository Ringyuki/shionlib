package downloadpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefilehistory"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

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
