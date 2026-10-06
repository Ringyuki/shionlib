package uploadpg

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const lastViolationSQL = `
SELECT GREATEST(
	(SELECT MAX(reviewed_at) FROM malware_scan_cases WHERE uploader_id = $1 AND status = 'DELETED' AND decision_source = 'ADMIN_DELETE'),
	(SELECT MAX(processed_at) FROM game_download_resource_reports WHERE reported_user_id = $1 AND status = 'VALID' AND malicious_level <> 'LOW')
)`

const storedBytesSQL = `
SELECT
	(SELECT COALESCE(SUM(f.file_size), 0)
	FROM game_download_resource_files f
	JOIN game_download_resources r ON r.id = f.game_download_resource_id
	WHERE f.creator_id = $1 AND f.type = $2 AND r.status = $3)
	+
	(SELECT COALESCE(SUM(s.total_size), 0)
	FROM game_upload_sessions s
	WHERE s.creator_id = $1 AND s.status = 'COMPLETED'
	AND NOT EXISTS (SELECT 1 FROM game_download_resource_files f WHERE f.upload_session_id = s.id))`

const inFlightBytesSQL = `
SELECT COALESCE(SUM(s.total_size), 0)
FROM game_upload_sessions s
WHERE s.creator_id = $1 AND s.status = 'UPLOADING' AND s.expires_at >= $2`

type QuotaRepository struct {
	client *ent.Client
}

func NewQuotaRepository(client *ent.Client) *QuotaRepository {
	return &QuotaRepository{client: client}
}

func (r *QuotaRepository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *QuotaRepository) Standing(ctx context.Context, userID int) (upload.Standing, error) {
	row, err := r.db(ctx).User.Query().Where(entuser.ID(userID)).Select(entuser.FieldRole, entuser.FieldUploadTrusted).Only(ctx)
	if err != nil {
		return upload.Standing{}, fmt.Errorf("read upload standing of user %d: %w", userID, err)
	}
	approved, err := r.db(ctx).GameDownloadResource.Query().
		Where(
			gamedownloadresource.CreatorID(userID),
			gamedownloadresource.Status(download.ResourceActive),
			gamedownloadresource.PublishedAtNotNil(),
		).
		Count(ctx)
	if err != nil {
		return upload.Standing{}, fmt.Errorf("count published resources of user %d: %w", userID, err)
	}
	var violation sql.NullTime
	if err := scalar(ctx, r.db(ctx), &violation, lastViolationSQL, userID); err != nil {
		return upload.Standing{}, fmt.Errorf("read last violation of user %d: %w", userID, err)
	}
	standing := upload.Standing{Role: actor.Role(row.Role), Approved: approved, Trusted: row.UploadTrusted}
	if violation.Valid {
		at := violation.Time.UTC()
		standing.LastViolation = &at
	}
	return standing, nil
}

func (r *QuotaRepository) StoredBytes(ctx context.Context, userID int) (int64, error) {
	var stored int64
	if err := scalar(ctx, r.db(ctx), &stored, storedBytesSQL, userID, download.FileTypeObjectStore, download.ResourceActive); err != nil {
		return 0, fmt.Errorf("sum stored bytes of user %d: %w", userID, err)
	}
	return stored, nil
}

func (r *QuotaRepository) InFlightBytes(ctx context.Context, userID int, now time.Time) (int64, error) {
	var inFlight int64
	if err := scalar(ctx, r.db(ctx), &inFlight, inFlightBytesSQL, userID, now.UTC()); err != nil {
		return 0, fmt.Errorf("sum in-flight bytes of user %d: %w", userID, err)
	}
	return inFlight, nil
}

func (r *QuotaRepository) SetTrusted(ctx context.Context, userID int, trusted bool) error {
	if err := r.db(ctx).User.UpdateOneID(userID).SetUploadTrusted(trusted).Exec(ctx); err != nil {
		return fmt.Errorf("set upload trust of user %d: %w", userID, err)
	}
	return nil
}
