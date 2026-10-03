package uploadpg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
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

func (r *Repository) CreateSession(ctx context.Context, in upload.NewSession) (upload.Session, error) {
	row, err := r.db(ctx).GameUploadSession.Create().
		SetFileName(in.FileName).
		SetTotalSize(in.TotalSize).
		SetChunkSize(int(in.ChunkSize)).
		SetTotalChunks(in.TotalChunks).
		SetUploadedChunks(pgvalue.Ints{}).
		SetHashAlgorithm(gameuploadsession.HashAlgorithmBlake3).
		SetFileSha256(in.FileHash).
		SetStatus(gameuploadsession.StatusUPLOADING).
		SetStoragePath(in.StoragePath).
		SetExpiresAt(in.ExpiresAt.UTC()).
		SetCreatorID(in.CreatorID).
		Save(ctx)
	if err != nil {
		return upload.Session{}, fmt.Errorf("create upload session: %w", err)
	}
	return toSession(row), nil
}

func (r *Repository) SetStoragePath(ctx context.Context, id int, path string) error {
	err := r.db(ctx).GameUploadSession.UpdateOneID(id).SetStoragePath(path).Exec(ctx)
	if postgres.IsNotFound(err) {
		return upload.ErrSessionNotFound
	}
	if err != nil {
		return fmt.Errorf("set upload session %d storage path: %w", id, err)
	}
	return nil
}

func (r *Repository) GetSession(ctx context.Context, id int) (upload.Session, error) {
	row, err := r.db(ctx).GameUploadSession.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return upload.Session{}, upload.ErrSessionNotFound
	}
	if err != nil {
		return upload.Session{}, fmt.Errorf("get upload session %d: %w", id, err)
	}
	return toSession(row), nil
}

func (r *Repository) LockSession(ctx context.Context, id int) (upload.Session, error) {
	row, err := r.db(ctx).GameUploadSession.Query().Where(gameuploadsession.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return upload.Session{}, upload.ErrSessionNotFound
	}
	if err != nil {
		return upload.Session{}, fmt.Errorf("lock upload session %d: %w", id, err)
	}
	return toSession(row), nil
}

func (r *Repository) ListUploading(ctx context.Context, creatorID int, now time.Time, limit int) ([]upload.Session, error) {
	rows, err := r.db(ctx).GameUploadSession.Query().
		Where(
			gameuploadsession.CreatorID(creatorID),
			gameuploadsession.StatusEQ(gameuploadsession.StatusUPLOADING),
			gameuploadsession.ExpiresAtGTE(now.UTC()),
		).
		Order(ent.Asc(gameuploadsession.FieldID)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list uploading sessions: %w", err)
	}
	return toSessions(rows), nil
}

func (r *Repository) AddChunk(ctx context.Context, id, index int) error {
	_, err := r.db(ctx).ExecContext(ctx,
		`UPDATE game_upload_sessions SET uploaded_chunks = array_append(uploaded_chunks, $2::integer), updated = $3 WHERE id = $1 AND NOT ($2::integer = ANY(uploaded_chunks))`,
		id, index, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("record upload chunk %d of session %d: %w", index, id, err)
	}
	return nil
}

func (r *Repository) SetStatus(ctx context.Context, id int, from, to upload.SessionStatus, mimeType *string) (bool, error) {
	update := r.db(ctx).GameUploadSession.Update().
		Where(gameuploadsession.ID(id), gameuploadsession.StatusEQ(gameuploadsession.Status(from))).
		SetStatus(gameuploadsession.Status(to))
	if mimeType != nil {
		update.SetMimeType(*mimeType)
	}
	changed, err := update.Save(ctx)
	if err != nil {
		return false, fmt.Errorf("set upload session %d status: %w", id, err)
	}
	return changed > 0, nil
}

func (r *Repository) ListStale(ctx context.Context, before time.Time, limit int) ([]upload.Session, error) {
	rows, err := r.db(ctx).GameUploadSession.Query().
		Where(gameuploadsession.Or(
			gameuploadsession.StatusEQ(gameuploadsession.StatusABORTED),
			gameuploadsession.And(
				gameuploadsession.StatusIn(gameuploadsession.StatusINITIATED, gameuploadsession.StatusUPLOADING),
				gameuploadsession.ExpiresAtLT(before.UTC()),
			),
			gameuploadsession.And(
				gameuploadsession.StatusEQ(gameuploadsession.StatusCOMPLETED),
				gameuploadsession.UpdatedLT(before.UTC()),
				gameuploadsession.Not(gameuploadsession.HasGameDownloadResourceFile()),
			),
		)).
		Order(ent.Asc(gameuploadsession.FieldID)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stale upload sessions: %w", err)
	}
	return toSessions(rows), nil
}

func (r *Repository) HasFile(ctx context.Context, sessionID int) (bool, error) {
	exists, err := r.db(ctx).GameDownloadResourceFile.Query().Where(gamedownloadresourcefile.UploadSessionID(sessionID)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check file of upload session %d: %w", sessionID, err)
	}
	return exists, nil
}

func (r *Repository) ReferencedPaths(ctx context.Context, paths []string) (map[string]bool, error) {
	referenced := map[string]bool{}
	if len(paths) == 0 {
		return referenced, nil
	}
	rows, err := r.db(ctx).QueryContext(ctx, `
SELECT storage_path FROM game_upload_sessions
WHERE storage_path = ANY($1::text[]) AND status IN ('INITIATED', 'UPLOADING', 'COMPLETED')
UNION
SELECT file_path FROM game_download_resource_files
WHERE file_path = ANY($1::text[])`, pgvalue.Strings(paths))
	if err != nil {
		return nil, fmt.Errorf("find referenced upload paths: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, fmt.Errorf("scan referenced upload path: %w", err)
		}
		referenced[path] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read referenced upload paths: %w", err)
	}
	return referenced, nil
}
