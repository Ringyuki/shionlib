package scantest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type MemoryRepository struct {
	mu        sync.Mutex
	now       func() time.Time
	files     map[int]scan.PendingFile
	resources map[int]bool
	cases     map[int]scan.Case
	nextCase  int
	Strikes   map[int]int
	Admins    []scan.Admin
	Names     map[int]string
	Titles    map[int]scan.GameTitles
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:       now,
		files:     map[int]scan.PendingFile{},
		resources: map[int]bool{},
		cases:     map[int]scan.Case{},
		Strikes:   map[int]int{},
		Names:     map[int]string{},
		Titles:    map[int]scan.GameTitles{},
	}
}

func (r *MemoryRepository) SeedFile(file scan.PendingFile) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.files[file.ID] = file
	r.resources[file.ResourceID] = true
}

func (r *MemoryRepository) SeedCase(c scan.Case) scan.Case {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextCase++
	c.ID = r.nextCase
	if c.Status == "" {
		c.Status = scan.CasePending
	}
	r.cases[c.ID] = c
	return c
}

func (r *MemoryRepository) File(id int) (scan.PendingFile, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	file, ok := r.files[id]
	return file, ok
}

func (r *MemoryRepository) HasResource(id int) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.resources[id]
}

func (r *MemoryRepository) Case(id int) scan.Case {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.cases[id]
}

func (r *MemoryRepository) ListPending(_ context.Context, limit int) ([]scan.PendingFile, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []scan.PendingFile
	for _, file := range r.files {
		if file.Type == download.FileTypeObjectStore && file.Status == download.FileOnServer && file.CheckStatus == download.CheckPending && file.Path != "" {
			out = append(out, file)
		}
	}
	slices.SortFunc(out, func(a, b scan.PendingFile) int { return cmp.Compare(a.ID, b.ID) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (r *MemoryRepository) LockFile(_ context.Context, fileID int) (scan.PendingFile, bool, error) {
	file, ok := r.File(fileID)
	return file, ok, nil
}

func (r *MemoryRepository) SetCheckStatus(_ context.Context, fileID int, status download.CheckStatus, _ bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	file := r.files[fileID]
	file.CheckStatus = status
	r.files[fileID] = file
	return nil
}

func (r *MemoryRepository) CreateCase(_ context.Context, in scan.NewCase) (scan.Case, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextCase++
	fileID, resourceID, gameID := in.FileID, in.ResourceID, in.GameID
	hash := in.HashAlgorithm
	created := scan.Case{
		ID:             r.nextCase,
		FileID:         &fileID,
		ResourceID:     &resourceID,
		GameID:         &gameID,
		UploaderID:     in.UploaderID,
		Status:         scan.CasePending,
		ReviewDeadline: in.ReviewDeadline,
		Detector:       scan.Detector,
		Viruses:        slices.Clone(in.Viruses),
		ScanResult:     in.ScanResult,
		ScanLogPath:    in.ScanLogPath,
		ScanLogExcerpt: in.ScanLogExcerpt,
		NotifyOnAllow:  true,
		FileName:       in.FileName,
		FileSize:       in.FileSize,
		HashAlgorithm:  &hash,
		FileHash:       in.FileHash,
		Created:        r.now(),
		Updated:        r.now(),
	}
	r.cases[created.ID] = created
	return created, nil
}

func (r *MemoryRepository) LockCase(_ context.Context, id int) (scan.Target, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.cases[id]
	if !ok {
		return scan.Target{}, scan.ErrCaseNotFound
	}
	target := scan.Target{Case: c}
	if c.FileID != nil {
		if file, ok := r.files[*c.FileID]; ok {
			path := file.Path
			target.File = &scan.CaseFile{ID: file.ID, Type: file.Type, Status: file.Status, CheckStatus: int(file.CheckStatus), UploadSessionID: file.UploadSessionID, CreatorID: file.CreatorID, Name: file.Name, Size: file.Size, Path: &path}
		}
	}
	if c.ResourceID != nil && r.resources[*c.ResourceID] {
		gameID := 0
		if c.GameID != nil {
			gameID = *c.GameID
		}
		target.ResourceGameID = &gameID
	}
	return target, nil
}

func (r *MemoryRepository) ResolveCase(_ context.Context, id int, resolution scan.Resolution) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	c := r.cases[id]
	c.Status = resolution.Status
	source := resolution.Source
	c.DecisionSource = &source
	c.ReviewedBy = resolution.ReviewedBy
	at := resolution.ReviewedAt
	c.ReviewedAt = &at
	c.ReviewNote = resolution.Note
	c.UploaderNotifiedAt = resolution.NotifiedAt
	if resolution.NotifyOnAllow != nil {
		c.NotifyOnAllow = *resolution.NotifyOnAllow
	}
	r.cases[id] = c
	return nil
}

func (r *MemoryRepository) ExpiredCases(_ context.Context, now time.Time, limit int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var ids []int
	for _, c := range r.cases {
		if c.Status == scan.CasePending && !c.ReviewDeadline.After(now) {
			ids = append(ids, c.ID)
		}
	}
	slices.Sort(ids)
	if len(ids) > limit {
		ids = ids[:limit]
	}
	return ids, nil
}

func (r *MemoryRepository) ListCases(_ context.Context, _ scan.ListFilter, _ scan.Page) ([]scan.CaseView, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []scan.CaseView
	for _, c := range r.cases {
		out = append(out, r.view(c))
	}
	slices.SortFunc(out, func(a, b scan.CaseView) int { return cmp.Compare(a.ID, b.ID) })
	return out, len(out), nil
}

func (r *MemoryRepository) GetCase(_ context.Context, id int) (scan.CaseView, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	c, ok := r.cases[id]
	if !ok {
		return scan.CaseView{}, scan.ErrCaseNotFound
	}
	return r.view(c), nil
}

func (r *MemoryRepository) view(c scan.Case) scan.CaseView {
	view := scan.CaseView{Case: c, Uploader: scan.Member{Summary: user.Summary{ID: c.UploaderID, Name: r.Names[c.UploaderID]}}}
	if c.FileID != nil {
		if file, ok := r.files[*c.FileID]; ok {
			view.File = &scan.CaseFile{ID: file.ID, Status: file.Status, CheckStatus: int(file.CheckStatus)}
		}
	}
	return view
}

func (r *MemoryRepository) AddStrike(_ context.Context, userID int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Strikes[userID]++
	return r.Strikes[userID], nil
}

func (r *MemoryRepository) ActiveAdmins(context.Context) ([]scan.Admin, error) {
	return slices.Clone(r.Admins), nil
}

func (r *MemoryRepository) UserName(_ context.Context, userID int) (string, bool, error) {
	name, ok := r.Names[userID]
	return name, ok, nil
}

func (r *MemoryRepository) GameTitles(_ context.Context, gameID int) (scan.GameTitles, bool, error) {
	titles, ok := r.Titles[gameID]
	return titles, ok, nil
}

func (r *MemoryRepository) RemoveFile(_ context.Context, fileID int) (download.File, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	file, ok := r.files[fileID]
	if !ok {
		return download.File{}, false, nil
	}
	delete(r.files, fileID)
	r.dropIfEmpty(file.ResourceID)
	path := file.Path
	return download.File{ID: file.ID, ResourceID: file.ResourceID, Path: &path, UploadSessionID: file.UploadSessionID, CreatorID: file.CreatorID}, true, nil
}

func (r *MemoryRepository) RemoveEmptyResource(_ context.Context, resourceID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.dropIfEmpty(resourceID)
	return nil
}

func (r *MemoryRepository) dropIfEmpty(resourceID int) {
	for _, file := range r.files {
		if file.ResourceID == resourceID {
			return
		}
	}
	delete(r.resources, resourceID)
}

type ArchiveTool struct {
	Listings map[string]scan.ToolRun
	Tests    map[string]scan.ToolRun
}

func (a *ArchiveTool) List(_ context.Context, path string) (scan.ToolRun, error) {
	return a.Listings[path], nil
}

func (a *ArchiveTool) Test(_ context.Context, path string) (scan.ToolRun, error) {
	return a.Tests[path], nil
}

type Scanner struct {
	Reports map[string]scan.Report
}

func (s *Scanner) Scan(_ context.Context, path string) (scan.Report, error) {
	return s.Reports[path], nil
}

type Ban struct {
	UserID   int
	BannedBy *int
	Reason   string
	Days     int
}

type Banner struct {
	Bans    []Ban
	Applied bool
}

func (b *Banner) Ban(_ context.Context, userID int, bannedBy *int, reason string, days int) (bool, error) {
	b.Bans = append(b.Bans, Ban{UserID: userID, BannedBy: bannedBy, Reason: reason, Days: days})
	return b.Applied, nil
}

type Mailer struct {
	Recipients [][]string
	Alerts     []scan.MalwareAlert
}

func (m *Mailer) MalwareDetected(_ context.Context, recipients []string, alert scan.MalwareAlert) error {
	m.Recipients = append(m.Recipients, recipients)
	m.Alerts = append(m.Alerts, alert)
	return nil
}
