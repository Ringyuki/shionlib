package uploadtest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Member struct {
	ID       int
	Active   bool
	Admin    bool
	Created  time.Time
	LastSeen time.Time
}

type ApprovedFile struct {
	CreatorID int
	Created   time.Time
}

type MemoryQuotaRepository struct {
	mu       sync.Mutex
	nextID   int
	quotas   map[int]upload.Quota
	records  []upload.QuotaRecord
	members  map[int]Member
	approved []ApprovedFile
}

func NewMemoryQuotaRepository() *MemoryQuotaRepository {
	return &MemoryQuotaRepository{quotas: map[int]upload.Quota{}, members: map[int]Member{}}
}

func (r *MemoryQuotaRepository) SeedQuota(q upload.Quota) upload.Quota {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	q.ID = r.nextID
	r.quotas[q.UserID] = q
	return q
}

func (r *MemoryQuotaRepository) SeedMember(m Member) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.members[m.ID] = m
}

func (r *MemoryQuotaRepository) SeedApprovedFile(f ApprovedFile) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.approved = append(r.approved, f)
}

func (r *MemoryQuotaRepository) Quota(userID int) upload.Quota {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.quotas[userID]
}

func (r *MemoryQuotaRepository) Records() []upload.QuotaRecord {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.records)
}

func (r *MemoryQuotaRepository) FindQuota(_ context.Context, userID int) (upload.Quota, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	quota, ok := r.quotas[userID]
	return quota, ok, nil
}

func (r *MemoryQuotaRepository) LockQuota(_ context.Context, userID int) (upload.Quota, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	quota, ok := r.quotas[userID]
	if !ok {
		return upload.Quota{}, upload.ErrQuotaNotFound
	}
	return quota, nil
}

func (r *MemoryQuotaRepository) AddRecord(_ context.Context, in upload.NewQuotaRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.records = append(r.records, upload.QuotaRecord{
		ID:        len(r.records) + 1,
		QuotaID:   in.QuotaID,
		Field:     in.Field,
		Action:    in.Action,
		Amount:    in.Amount,
		Reason:    in.Reason,
		SessionID: in.SessionID,
	})
	return nil
}

func (r *MemoryQuotaRepository) AddUsed(_ context.Context, quotaID int, delta int64) error {
	return r.update(quotaID, func(q *upload.Quota) { q.Used += delta })
}

func (r *MemoryQuotaRepository) AddSize(_ context.Context, quotaID int, delta int64) error {
	return r.update(quotaID, func(q *upload.Quota) { q.Size += delta })
}

func (r *MemoryQuotaRepository) SetUsed(_ context.Context, quotaID int, used int64) error {
	return r.update(quotaID, func(q *upload.Quota) { q.Used = used })
}

func (r *MemoryQuotaRepository) MarkFirstGrant(_ context.Context, quotaID int) error {
	return r.update(quotaID, func(q *upload.Quota) { q.IsFirstGrant = true })
}

func (r *MemoryQuotaRepository) FindWithdrawable(_ context.Context, userID, sessionID int) (upload.QuotaRecord, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	quota, ok := r.quotas[userID]
	if !ok {
		return upload.QuotaRecord{}, false, nil
	}
	for _, record := range r.records {
		if record.QuotaID != quota.ID || record.Withdrawn || record.Field != upload.FieldUsed || record.SessionID == nil || *record.SessionID != sessionID {
			continue
		}
		if record.Action == upload.ActionUse || record.Action == upload.ActionAdd {
			return record, true, nil
		}
	}
	return upload.QuotaRecord{}, false, nil
}

func (r *MemoryQuotaRepository) MarkWithdrawn(_ context.Context, recordID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.records {
		if r.records[i].ID == recordID {
			r.records[i].Withdrawn = true
		}
	}
	return nil
}

func (r *MemoryQuotaRepository) CountApprovedFiles(_ context.Context, userID int, since time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for _, file := range r.approved {
		if file.CreatorID == userID && !file.Created.Before(since) {
			count++
		}
	}
	return count, nil
}

func (r *MemoryQuotaRepository) GrantCandidates(_ context.Context, registeredBefore time.Time, afterID, limit int) ([]int, error) {
	return r.memberIDs(func(m Member, q upload.Quota, hasQuota bool) bool {
		return hasQuota && !q.IsFirstGrant && !m.Created.After(registeredBefore)
	}, afterID, limit), nil
}

func (r *MemoryQuotaRepository) ActiveUploaders(_ context.Context, afterID, limit int) ([]int, error) {
	return r.memberIDs(func(_ Member, _ upload.Quota, hasQuota bool) bool { return hasQuota }, afterID, limit), nil
}

func (r *MemoryQuotaRepository) InactiveUploaders(_ context.Context, lastSeenBefore time.Time, afterID, limit int) ([]int, error) {
	return r.memberIDs(func(m Member, _ upload.Quota, hasQuota bool) bool {
		return hasQuota && m.LastSeen.Before(lastSeenBefore)
	}, afterID, limit), nil
}

func (r *MemoryQuotaRepository) memberIDs(keep func(Member, upload.Quota, bool) bool, afterID, limit int) []int {
	r.mu.Lock()
	defer r.mu.Unlock()
	var ids []int
	for _, member := range r.members {
		if !member.Active || member.Admin || member.ID <= afterID {
			continue
		}
		quota, hasQuota := r.quotas[member.ID]
		if keep(member, quota, hasQuota) {
			ids = append(ids, member.ID)
		}
	}
	slices.SortFunc(ids, cmp.Compare[int])
	if len(ids) > limit {
		ids = ids[:limit]
	}
	return ids
}

func (r *MemoryQuotaRepository) update(quotaID int, fn func(*upload.Quota)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for userID, quota := range r.quotas {
		if quota.ID == quotaID {
			fn(&quota)
			r.quotas[userID] = quota
			return nil
		}
	}
	return upload.ErrQuotaNotFound
}
