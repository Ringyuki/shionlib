package uploadpg

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/uploadfailure"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

const uploadEntriesSQL = `
WITH entries AS (
	SELECT 'session' AS kind, s.id, s.created AS started, s.creator_id AS user_id, s.file_name, s.total_size AS size,
		s.status::text AS status, s.chunk_size, s.total_chunks, s.uploaded_chunks AS received,
		s.hash_algorithm::text AS hash_algorithm, s.file_sha256, s.expires_at, s.last_chunk_at, s.completed_at,
		s.submitted_at, s.aborted_at, s.ended_at, s.updated,
		f.id AS file_id, f.type AS file_type, f.file_status, f.file_check_status, f.inspection_id, f.file_name AS file_label,
		r.id AS resource_id, r.status AS resource_status, r.published_at, g.id AS game_id, g.title_jp, g.title_zh, g.title_en,
		(SELECT count(*) FROM upload_failures u WHERE u.session_id = s.id) AS failures
	FROM game_upload_sessions s
	LEFT JOIN game_download_resource_files f ON f.upload_session_id = s.id
	LEFT JOIN game_download_resources r ON r.id = f.game_download_resource_id
	LEFT JOIN games g ON g.id = r.game_id
	UNION ALL
	SELECT 'attempt', u.id, u.created, u.user_id, u.file_name, u.file_size,
		NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
		NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
		1
	FROM upload_failures u
	WHERE u.session_id IS NULL
), staged AS (
	SELECT e.*, CASE
		WHEN e.kind = 'attempt' THEN 'not_started'
		WHEN e.aborted_at IS NOT NULL OR e.status = 'ABORTED' THEN 'canceled'
		WHEN e.file_id IS NOT NULL THEN CASE
			WHEN e.file_type <> $1 THEN 'published'
			WHEN e.file_check_status = ANY($2::integer[]) THEN 'processing'
			WHEN e.file_status = $3 THEN 'published'
			WHEN e.file_check_status = ANY($4::integer[]) THEN 'rejected'
			ELSE 'processing'
		END
		WHEN e.submitted_at IS NOT NULL THEN 'published'
		WHEN e.status = 'COMPLETED' THEN 'pending'
		WHEN e.status = 'UPLOADING' AND e.expires_at >= $5 THEN 'uploading'
		ELSE 'expired'
	END AS stage
	FROM entries e
)
SELECT st.kind, st.id, st.started, st.user_id, us.name, st.file_name, st.size, st.status, st.chunk_size, st.total_chunks,
	st.received, st.hash_algorithm, st.file_sha256, st.expires_at, st.last_chunk_at, st.completed_at, st.submitted_at,
	st.aborted_at, st.ended_at, st.updated, st.file_id, st.file_type, st.file_status, st.file_check_status,
	st.inspection_id, st.file_label, st.resource_id, st.resource_status, st.published_at, st.game_id,
	st.title_jp, st.title_zh, st.title_en, st.failures, count(*) OVER () AS total
FROM staged st
JOIN users us ON us.id = st.user_id
WHERE ($6 = '' OR st.stage = $6)
	AND ($7 = 0 OR st.user_id = $7)
	AND (NOT $8 OR st.failures > 0)
	AND ($9 = '' OR st.file_name ILIKE $9 ESCAPE '\' OR us.name ILIKE $9 ESCAPE '\')
	AND ($10 = '' OR (st.kind = $10 AND st.id = $11))
ORDER BY st.started DESC, st.id DESC
LIMIT $12 OFFSET $13`

var heldChecks = []int{int(download.CheckHarmfulPendingReview), int(download.CheckStalled)}

func rejectedChecks() []int {
	var rejected []int
	for status := download.CheckPending; status <= download.CheckAbandoned; status++ {
		if status.Rejected() {
			rejected = append(rejected, int(status))
		}
	}
	return rejected
}

type AdminStore struct {
	client *ent.Client
}

func NewAdminStore(client *ent.Client) *AdminStore {
	return &AdminStore{client: client}
}

func (s *AdminStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

type uploadQuery struct {
	filter download.UploadFilter
	kind   download.UploadKind
	id     int
	limit  int
	offset int
}

func (s *AdminStore) Uploads(ctx context.Context, filter download.UploadFilter, page download.Page) ([]download.Upload, int, error) {
	return s.entries(ctx, uploadQuery{filter: filter, limit: page.Size, offset: (page.Number - 1) * page.Size})
}

func (s *AdminStore) SessionUpload(ctx context.Context, id int) (download.UploadDetail, error) {
	return s.detail(ctx, download.UploadSession, id, upload.ErrSessionNotFound, uploadfailure.SessionID(id))
}

func (s *AdminStore) AttemptUpload(ctx context.Context, id int) (download.UploadDetail, error) {
	return s.detail(ctx, download.UploadAttempt, id, upload.ErrFailureNotFound, uploadfailure.ID(id), uploadfailure.SessionIDIsNil())
}

func (s *AdminStore) detail(ctx context.Context, kind download.UploadKind, id int, missing error, failures ...predicate.UploadFailure) (download.UploadDetail, error) {
	found, _, err := s.entries(ctx, uploadQuery{filter: download.UploadFilter{Now: time.Now()}, kind: kind, id: id, limit: 1})
	if err != nil {
		return download.UploadDetail{}, err
	}
	if len(found) == 0 {
		return download.UploadDetail{}, missing
	}
	rows, err := s.db(ctx).UploadFailure.Query().Where(failures...).Order(ent.Desc(uploadfailure.FieldCreated), ent.Desc(uploadfailure.FieldID)).All(ctx)
	if err != nil {
		return download.UploadDetail{}, fmt.Errorf("load the failures of %s upload %d: %w", kind, id, err)
	}
	recorded := make([]upload.Failure, len(rows))
	for i, row := range rows {
		if recorded[i], err = toFailure(row); err != nil {
			return download.UploadDetail{}, err
		}
	}
	return download.UploadDetail{Upload: found[0], Failures: recorded}, nil
}

func (s *AdminStore) entries(ctx context.Context, q uploadQuery) ([]download.Upload, int, error) {
	stage := ""
	if q.filter.Stage != nil {
		stage = string(*q.filter.Stage)
	}
	userID := 0
	if q.filter.UserID != nil {
		userID = *q.filter.UserID
	}
	pattern := ""
	if query := strings.TrimSpace(q.filter.Query); query != "" {
		pattern = "%" + likeEscaper.Replace(query) + "%"
	}
	rows, err := s.db(ctx).QueryContext(ctx, uploadEntriesSQL,
		download.FileTypeObjectStore, pgvalue.Ints(heldChecks), download.FileInObjectStore, pgvalue.Ints(rejectedChecks()), q.filter.Now.UTC(),
		stage, userID, q.filter.FailedOnly, pattern, string(q.kind), q.id, q.limit, q.offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list uploads: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	uploads := []download.Upload{}
	total := 0
	for rows.Next() {
		entry, count, err := scanUpload(rows)
		if err != nil {
			return nil, 0, err
		}
		uploads = append(uploads, entry)
		total = count
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("read uploads: %w", err)
	}
	return uploads, total, nil
}
