package reporttest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type MemoryRepository struct {
	mu      sync.Mutex
	now     func() time.Time
	nextID  int
	reports map[int]report.Report
	Members map[int]report.Member
	Admins  []report.Admin
	Games   map[int]report.GameTitles
	GameOf  map[int]int
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{now: now, reports: map[int]report.Report{}, Members: map[int]report.Member{}, Games: map[int]report.GameTitles{}, GameOf: map[int]int{}}
}

func (r *MemoryRepository) AddMember(id, role, status int, name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Members[id] = report.Member{Summary: user.Summary{ID: id, Name: name}, Role: role, Status: status}
}

func (r *MemoryRepository) Seed(rep report.Report) report.Report {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	rep.ID = r.nextID
	if rep.Status == "" {
		rep.Status = report.StatusPending
	}
	if rep.Created.IsZero() {
		rep.Created = r.now()
	}
	if rep.Updated.IsZero() {
		rep.Updated = rep.Created
	}
	r.reports[rep.ID] = rep
	return rep
}

func (r *MemoryRepository) Report(id int) report.Report {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.reports[id]
}

func (r *MemoryRepository) CountInvalidSince(_ context.Context, reporterID int, since time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for _, rep := range r.reports {
		if rep.ReporterID == reporterID && rep.Status == report.StatusInvalid && !rep.Created.Before(since) {
			count++
		}
	}
	return count, nil
}

func (r *MemoryRepository) HasPending(_ context.Context, resourceID, reporterID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, rep := range r.reports {
		if rep.ResourceID == resourceID && rep.ReporterID == reporterID && rep.Status == report.StatusPending {
			return true, nil
		}
	}
	return false, nil
}

func (r *MemoryRepository) Create(_ context.Context, in report.NewReport) (report.Report, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	created := report.Report{
		ID:             r.nextID,
		ResourceID:     in.ResourceID,
		ReporterID:     in.ReporterID,
		ReportedUserID: in.ReportedUserID,
		Reason:         in.Reason,
		Detail:         in.Detail,
		Status:         report.StatusPending,
		Level:          in.Level,
		Created:        r.now(),
		Updated:        r.now(),
	}
	r.reports[created.ID] = created
	return created, nil
}

func (r *MemoryRepository) Lock(_ context.Context, id int) (report.Report, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rep, ok := r.reports[id]
	if !ok {
		return report.Report{}, report.ErrNotFound
	}
	return rep, nil
}

func (r *MemoryRepository) Resolve(_ context.Context, id int, resolution report.Resolution) error {
	return r.mutate(id, func(rep *report.Report) {
		rep.Status = resolution.Status
		rep.Level = resolution.Level
		by, at := resolution.ProcessedBy, resolution.ProcessedAt
		rep.ProcessedBy = &by
		rep.ProcessedAt = &at
		rep.ProcessNote = resolution.Note
	})
}

func (r *MemoryRepository) MarkReportedPenalty(_ context.Context, id int, applied bool) error {
	return r.mutate(id, func(rep *report.Report) { rep.ReportedPenaltyApplied = applied })
}

func (r *MemoryRepository) MarkReporterPenalty(_ context.Context, id int, applied bool) error {
	return r.mutate(id, func(rep *report.Report) { rep.ReporterPenaltyApplied = applied })
}

func (r *MemoryRepository) List(_ context.Context, _ report.ListFilter, _ report.Page) ([]report.View, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []report.View
	for _, rep := range r.reports {
		out = append(out, r.view(rep))
	}
	slices.SortFunc(out, func(a, b report.View) int { return cmp.Compare(a.ID, b.ID) })
	return out, len(out), nil
}

func (r *MemoryRepository) Get(_ context.Context, id int) (report.View, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rep, ok := r.reports[id]
	if !ok {
		return report.View{}, report.ErrNotFound
	}
	return r.view(rep), nil
}

func (r *MemoryRepository) view(rep report.Report) report.View {
	gameID := r.GameOf[rep.ResourceID]
	return report.View{
		Report:       rep,
		Resource:     report.ResourceRef{ID: rep.ResourceID, GameID: gameID, Game: r.Games[gameID]},
		Reporter:     r.Members[rep.ReporterID],
		ReportedUser: r.Members[rep.ReportedUserID],
	}
}

func (r *MemoryRepository) Member(_ context.Context, userID int) (report.Member, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	member, ok := r.Members[userID]
	return member, ok, nil
}

func (r *MemoryRepository) ActiveAdmins(context.Context) ([]report.Admin, error) {
	return slices.Clone(r.Admins), nil
}

func (r *MemoryRepository) mutate(id int, fn func(*report.Report)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rep, ok := r.reports[id]
	if !ok {
		return report.ErrNotFound
	}
	fn(&rep)
	r.reports[id] = rep
	return nil
}

type Resources struct {
	Items     map[int]download.Resource
	Keys      map[int][]string
	TakenDown []int
	Purged    [][]string
}

func NewResources() *Resources {
	return &Resources{Items: map[int]download.Resource{}, Keys: map[int][]string{}}
}

func (r *Resources) Resource(_ context.Context, id int) (download.Resource, error) {
	resource, ok := r.Items[id]
	if !ok {
		return download.Resource{}, download.ErrResourceNotFound
	}
	return resource, nil
}

func (r *Resources) TakeDown(_ context.Context, id int) ([]string, error) {
	resource, ok := r.Items[id]
	if !ok {
		return nil, download.ErrResourceNotFound
	}
	resource.Status = download.ResourceRemoved
	r.Items[id] = resource
	r.TakenDown = append(r.TakenDown, id)
	return r.Keys[id], nil
}

func (r *Resources) PurgeLater(_ context.Context, keys []string) error {
	if len(keys) > 0 {
		r.Purged = append(r.Purged, keys)
	}
	return nil
}

type Adjustment struct {
	UserID int
	Action upload.QuotaAction
	Amount int64
	Reason string
}

type Quota struct {
	Adjustments []Adjustment
	Missing     map[int]bool
}

func (q *Quota) AdjustSize(_ context.Context, userID int, action upload.QuotaAction, amount int64, reason string) (int64, error) {
	if q.Missing[userID] {
		return 0, upload.ErrQuotaNotFound
	}
	q.Adjustments = append(q.Adjustments, Adjustment{UserID: userID, Action: action, Amount: amount, Reason: reason})
	return amount, nil
}

type Ban struct {
	UserID int
	Reason string
	Days   int
}

type Banner struct {
	Bans []Ban
}

func (b *Banner) Ban(_ context.Context, userID int, _ *int, reason string, days int) (bool, error) {
	b.Bans = append(b.Bans, Ban{UserID: userID, Reason: reason, Days: days})
	return true, nil
}

type Mailer struct {
	Alerts []report.ReportAlert
}

func (m *Mailer) ReportFiled(_ context.Context, _ []string, alert report.ReportAlert) error {
	m.Alerts = append(m.Alerts, alert)
	return nil
}
