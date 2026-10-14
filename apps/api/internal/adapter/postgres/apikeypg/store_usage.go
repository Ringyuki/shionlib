package apikeypg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/apikeydailyusage"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userapikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

const (
	summaryQuery = `SELECT
  coalesce(sum(requests) FILTER (WHERE day = $1), 0)::int,
  coalesce(sum(throttled), 0)::int,
  count(DISTINCT key_id) FILTER (WHERE requests > 0)::int,
  (SELECT count(*) FROM user_api_keys)::int
FROM api_key_daily_usages WHERE day >= $2`
	daysQuery = `SELECT day, sum(requests)::int, sum(throttled)::int
FROM api_key_daily_usages
WHERE day >= $1 AND ($2::int IS NULL OR key_id = $2)
GROUP BY day ORDER BY day`
	listQuery = `SELECT k.id, coalesce(r.requests, 0), coalesce(r.throttled, 0), count(*) OVER ()
FROM user_api_keys k
JOIN users u ON u.id = k.user_id
LEFT JOIN (
  SELECT key_id, sum(requests)::int AS requests, sum(throttled)::int AS throttled
  FROM api_key_daily_usages WHERE day >= $1 GROUP BY key_id
) r ON r.key_id = k.id
WHERE ($2::int IS NULL OR k.status = $2)
  AND ($3::int IS NULL OR k.user_id = $3)
  AND ($4::text = '' OR strpos(lower(k.name), lower($4)) > 0 OR strpos(lower(u.name), lower($4)) > 0 OR starts_with(k.prefix, $4))
ORDER BY `
	listTail = ` LIMIT $5 OFFSET $6`
)

var orders = map[apikey.Sort]string{
	apikey.SortRequests: `coalesce(r.requests, 0) DESC, k.id DESC`,
	apikey.SortUsed:     `k.last_used_at DESC NULLS LAST, k.id DESC`,
	apikey.SortCreated:  `k.created DESC, k.id DESC`,
}

type UsageStore struct {
	client *ent.Client
}

func NewUsageStore(client *ent.Client) *UsageStore {
	return &UsageStore{client: client}
}

func (s *UsageStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *UsageStore) SaveCounts(ctx context.Context, counts []apikey.Count) error {
	if len(counts) == 0 {
		return nil
	}
	known, err := s.db(ctx).UserAPIKey.Query().Where(userapikey.IDIn(keyIDs(counts)...)).IDs(ctx)
	if err != nil {
		return fmt.Errorf("check counted API keys: %w", err)
	}
	exists := make(map[int]bool, len(known))
	for _, id := range known {
		exists[id] = true
	}
	builders := make([]*ent.APIKeyDailyUsageCreate, 0, len(counts))
	for _, count := range counts {
		if !exists[count.KeyID] {
			continue
		}
		builders = append(builders, s.db(ctx).APIKeyDailyUsage.Create().
			SetKeyID(count.KeyID).
			SetDay(count.Day).
			SetRequests(count.Requests).
			SetThrottled(count.Throttled))
	}
	if len(builders) == 0 {
		return nil
	}
	err = s.db(ctx).APIKeyDailyUsage.CreateBulk(builders...).
		OnConflictColumns(apikeydailyusage.FieldKeyID, apikeydailyusage.FieldDay).
		UpdateNewValues().
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("save API key usage: %w", err)
	}
	return nil
}

func (s *UsageStore) PruneBefore(ctx context.Context, day time.Time) error {
	if _, err := s.db(ctx).APIKeyDailyUsage.Delete().Where(apikeydailyusage.DayLT(day)).Exec(ctx); err != nil {
		return fmt.Errorf("prune API key usage: %w", err)
	}
	return nil
}

func (s *UsageStore) Summary(ctx context.Context, today, since time.Time) (apikey.Summary, error) {
	var summary apikey.Summary
	rows, err := s.db(ctx).QueryContext(ctx, summaryQuery, today, since)
	if err != nil {
		return summary, fmt.Errorf("sum API key usage: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	if rows.Next() {
		if err := rows.Scan(&summary.Today, &summary.Throttled, &summary.Used, &summary.Total); err != nil {
			return summary, fmt.Errorf("scan API key usage: %w", err)
		}
	}
	return summary, rows.Err()
}

func (s *UsageStore) Days(ctx context.Context, since time.Time, keyID *int) ([]apikey.Day, error) {
	rows, err := s.db(ctx).QueryContext(ctx, daysQuery, since, keyID)
	if err != nil {
		return nil, fmt.Errorf("read daily API key usage: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	days := []apikey.Day{}
	for rows.Next() {
		var day apikey.Day
		if err := rows.Scan(&day.Day, &day.Requests, &day.Throttled); err != nil {
			return nil, fmt.Errorf("scan daily API key usage: %w", err)
		}
		day.Day = day.Day.UTC()
		days = append(days, day)
	}
	return days, rows.Err()
}

func (s *UsageStore) List(ctx context.Context, filter apikey.Filter, page paging.Page) ([]apikey.Listed, int, error) {
	order, ok := orders[filter.Sort]
	if !ok {
		order = orders[apikey.SortRequests]
	}
	var status *int
	if filter.Status != nil {
		value := int(*filter.Status)
		status = &value
	}
	rows, err := s.db(ctx).QueryContext(ctx, listQuery+order+listTail, filter.Since, status, filter.UserID, filter.Query, page.Size, page.Offset())
	if err != nil {
		return nil, 0, fmt.Errorf("list API keys: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var ids []int
	recent := map[int]apikey.Usage{}
	total := 0
	for rows.Next() {
		var id int
		var usage apikey.Usage
		if err := rows.Scan(&id, &usage.Requests, &usage.Throttled, &total); err != nil {
			return nil, 0, fmt.Errorf("scan API key: %w", err)
		}
		ids = append(ids, id)
		recent[id] = usage
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("list API keys: %w", err)
	}
	listed, err := s.listed(ctx, ids, recent)
	return listed, total, err
}

func (s *UsageStore) Detail(ctx context.Context, id int, since time.Time) (apikey.Detail, error) {
	row, err := s.db(ctx).UserAPIKey.Query().Where(userapikey.ID(id)).WithUser().Only(ctx)
	if postgres.IsNotFound(err) {
		return apikey.Detail{}, apikey.ErrNotFound
	}
	if err != nil {
		return apikey.Detail{}, fmt.Errorf("get API key %d: %w", id, err)
	}
	days, err := s.Days(ctx, since, &id)
	if err != nil {
		return apikey.Detail{}, err
	}
	var total apikey.Usage
	for _, day := range days {
		total.Requests += day.Requests
		total.Throttled += day.Throttled
	}
	others, err := s.db(ctx).UserAPIKey.Query().
		Where(userapikey.UserID(row.UserID), userapikey.IDNEQ(id)).
		Order(ent.Desc(userapikey.FieldCreated), ent.Desc(userapikey.FieldID)).
		All(ctx)
	if err != nil {
		return apikey.Detail{}, fmt.Errorf("list the other API keys of user %d: %w", row.UserID, err)
	}
	owner := row.Edges.User
	return apikey.Detail{
		Listed:       apikey.Listed{Key: toKey(row), Owner: userpg.ToSummary(owner), Recent: total},
		Days:         days,
		Total:        total,
		AccountLimit: owner.APIRequestLimit,
		Others:       toKeys(others),
	}, nil
}

func (s *UsageStore) listed(ctx context.Context, ids []int, recent map[int]apikey.Usage) ([]apikey.Listed, error) {
	if len(ids) == 0 {
		return []apikey.Listed{}, nil
	}
	rows, err := s.db(ctx).UserAPIKey.Query().Where(userapikey.IDIn(ids...)).WithUser(userpg.SelectSummary).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load API keys: %w", err)
	}
	byID := make(map[int]*ent.UserAPIKey, len(rows))
	for _, row := range rows {
		byID[row.ID] = row
	}
	listed := make([]apikey.Listed, 0, len(ids))
	for _, id := range ids {
		row, ok := byID[id]
		if !ok {
			continue
		}
		listed = append(listed, apikey.Listed{Key: toKey(row), Owner: userpg.ToSummary(row.Edges.User), Recent: recent[id]})
	}
	return listed, nil
}

func keyIDs(counts []apikey.Count) []int {
	ids := make([]int, len(counts))
	for i, count := range counts {
		ids[i] = count.KeyID
	}
	return ids
}
