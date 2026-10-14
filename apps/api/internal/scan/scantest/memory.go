package scantest

import (
	"cmp"
	"context"
	"io"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type MemoryRepository struct {
	mu        sync.Mutex
	now       func() time.Time
	files     map[int]scan.PendingFile
	resources map[int]bool
	retryAt   map[int]time.Time
	reasons   map[int]string
	cases     map[int]scan.Case
	nextCase  int
	Strikes   map[int]int
	Admins    []scan.Admin
	Names     map[int]string
	Titles    map[int]scan.GameTitles
	Keys      map[int][]string
	TakenDown []int
	Forms     []ReadForm
	InspectAt map[int]time.Time
	Purged    []string
	Cleared   []ClearedReview
	Digests   map[int]string
	Downloads map[int]int

	FailureErr error
}

type ReadForm struct {
	ResourceID int
	Form       download.Form
}

type ClearedReview struct {
	ResourceID int
	FileName   string
	ReviewerID *int
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:       now,
		files:     map[int]scan.PendingFile{},
		resources: map[int]bool{},
		retryAt:   map[int]time.Time{},
		reasons:   map[int]string{},
		cases:     map[int]scan.Case{},
		Strikes:   map[int]int{},
		Names:     map[int]string{},
		Titles:    map[int]scan.GameTitles{},
		Keys:      map[int][]string{},
		InspectAt: map[int]time.Time{},
		Digests:   map[int]string{},
		Downloads: map[int]int{},
	}
}

func (r *MemoryRepository) SeedFile(file scan.PendingFile) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.files[file.ID] = file
	r.resources[file.ResourceID] = true
}

func (r *MemoryRepository) SeedResource(id int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.resources[id] = true
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

func (r *MemoryRepository) RetryAt(resourceID int) time.Time {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.retryAt[resourceID]
}

func (r *MemoryRepository) PendingResources(_ context.Context, now time.Time) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []int
	for _, file := range r.files {
		due := !r.retryAt[file.ResourceID].After(now)
		if r.resources[file.ResourceID] && due && file.Type == download.FileTypeObjectStore && file.Status == download.FileOnServer && file.CheckStatus == download.CheckPending && file.Path != "" && !slices.Contains(out, file.ResourceID) {
			out = append(out, file.ResourceID)
		}
	}
	slices.Sort(out)
	return out, nil
}

func (r *MemoryRepository) NextUninspected(_ context.Context, skip []int, now time.Time) (int, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var waiting []int
	for _, file := range r.files {
		stored := file.Type == download.FileTypeObjectStore && file.Status == download.FileInObjectStore && file.CheckStatus == download.CheckOK
		due := !r.InspectAt[file.ResourceID].After(now)
		if r.resources[file.ResourceID] && stored && due && file.StorageKey != "" && file.InspectionID == nil && !slices.Contains(skip, file.ResourceID) && !slices.Contains(waiting, file.ResourceID) {
			waiting = append(waiting, file.ResourceID)
		}
	}
	if len(waiting) == 0 {
		return 0, false, nil
	}
	slices.SortFunc(waiting, func(a, b int) int {
		return cmp.Or(cmp.Compare(r.Downloads[b], r.Downloads[a]), cmp.Compare(a, b))
	})
	return waiting[0], true, nil
}

func (r *MemoryRepository) DelayInspection(_ context.Context, resourceID int, until time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.resources[resourceID] {
		return download.ErrResourceNotFound
	}
	r.InspectAt[resourceID] = until
	return nil
}

func (r *MemoryRepository) DelayCheck(_ context.Context, resourceID int, until time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.retryAt[resourceID] = until
	return nil
}

func (r *MemoryRepository) CheckError(fileID int) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.reasons[fileID]
}

func (r *MemoryRepository) RecordCheckFailure(_ context.Context, fileID int, failure scan.CheckFailure) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.FailureErr != nil {
		return r.FailureErr
	}
	file := r.files[fileID]
	file.CheckFailures = failure.Failures
	if failure.StalledAt != nil {
		file.CheckStatus = download.CheckStalled
		file.StalledAt = failure.StalledAt
	}
	r.files[fileID] = file
	r.reasons[fileID] = failure.Reason
	return nil
}

func (r *MemoryRepository) ResumeCheck(_ context.Context, fileID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	file := r.files[fileID]
	file.CheckStatus = download.CheckPending
	file.CheckFailures = 0
	file.StalledAt = nil
	r.files[fileID] = file
	delete(r.reasons, fileID)
	return nil
}

func (r *MemoryRepository) StalledFiles(_ context.Context, since *time.Time, limit int) ([]scan.PendingFile, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []scan.PendingFile
	for _, file := range r.files {
		if file.Type != download.FileTypeObjectStore || file.Status != download.FileOnServer || file.CheckStatus != download.CheckStalled {
			continue
		}
		if since != nil && (file.StalledAt == nil || file.StalledAt.After(*since)) {
			continue
		}
		out = append(out, file)
	}
	slices.SortFunc(out, func(a, b scan.PendingFile) int { return a.ID - b.ID })
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (r *MemoryRepository) StalledEntries(ctx context.Context, limit int) ([]scan.StalledEntry, error) {
	files, err := r.StalledFiles(ctx, nil, limit)
	if err != nil {
		return nil, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	entries := make([]scan.StalledEntry, len(files))
	for i, file := range files {
		entries[i] = scan.StalledEntry{
			File:     file,
			Reason:   r.reasons[file.ID],
			Game:     r.Titles[file.GameID],
			Uploader: user.Summary{ID: file.CreatorID, Name: r.Names[file.CreatorID]},
		}
	}
	return entries, nil
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

func (r *MemoryRepository) SetInspection(_ context.Context, fileID, inspectionID int, sha256 string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	file := r.files[fileID]
	file.InspectionID = &inspectionID
	r.files[fileID] = file
	r.Digests[fileID] = sha256
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
		published := c.FileID != nil && r.files[*c.FileID].Status == download.FileInObjectStore
		if c.Status == scan.CasePending && !c.ReviewDeadline.After(now) && !published {
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

func (r *MemoryRepository) ResourceFiles(_ context.Context, resourceID int) ([]scan.PendingFile, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []scan.PendingFile
	for _, file := range r.files {
		if file.ResourceID == resourceID {
			out = append(out, file)
		}
	}
	slices.SortFunc(out, func(a, b scan.PendingFile) int { return cmp.Compare(a.ID, b.ID) })
	return out, nil
}

func (r *MemoryRepository) TakeDown(_ context.Context, resourceID int) ([]string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.resources[resourceID] {
		return nil, download.ErrResourceNotFound
	}
	r.resources[resourceID] = false
	r.TakenDown = append(r.TakenDown, resourceID)
	return r.Keys[resourceID], nil
}

func (r *MemoryRepository) FormRead(_ context.Context, resourceID int, form download.Form) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.resources[resourceID] {
		return download.ErrResourceNotFound
	}
	r.Forms = append(r.Forms, ReadForm{ResourceID: resourceID, Form: form})
	return nil
}

func (r *MemoryRepository) ReviewCleared(_ context.Context, resourceID int, fileName string, reviewerID *int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.resources[resourceID] {
		return download.ErrResourceNotFound
	}
	r.Cleared = append(r.Cleared, ClearedReview{ResourceID: resourceID, FileName: fileName, ReviewerID: reviewerID})
	return nil
}

func (r *MemoryRepository) PurgeLater(_ context.Context, keys []string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(keys) > 0 {
		r.Purged = append(r.Purged, keys...)
	}
	return nil
}

type ArchiveTool struct {
	Listings   map[string]scan.ToolRun
	Tests      map[string]scan.ToolRun
	Contents   map[string][]string
	Extracts   map[string]scan.ToolRun
	EntryRuns  map[string]scan.ToolRun
	Workspace  *Workspace
	Inspected  []string
	Extracted  []string
	Selections []scan.Selection
	Separated  []string
	OnList     func()
}

func (a *ArchiveTool) List(ctx context.Context, path string) (scan.ToolRun, error) {
	a.Inspected = append(a.Inspected, path)
	if a.OnList != nil {
		a.OnList()
	}
	if err := ctx.Err(); err != nil {
		return scan.ToolRun{}, err
	}
	return a.Listings[path], nil
}

func (a *ArchiveTool) Test(_ context.Context, path string) (scan.ToolRun, error) {
	return a.Tests[path], nil
}

func (a *ArchiveTool) Extract(_ context.Context, path, destination string, selection scan.Selection) (scan.ToolRun, error) {
	a.Extracted = append(a.Extracted, path)
	a.Selections = append(a.Selections, selection)
	for _, entry := range a.Contents[path] {
		wanted := slices.Contains(selection.Paths, entry) || slices.Contains(selection.Extensions, strings.TrimPrefix(strings.ToLower(filepath.Ext(entry)), "."))
		if wanted && !slices.Contains(selection.Skip, entry) {
			a.Workspace.Put(destination, entry)
		}
	}
	return a.Extracts[path], nil
}

func (a *ArchiveTool) ExtractEntry(_ context.Context, path, entry, destination, name string) (scan.ToolRun, error) {
	a.Separated = append(a.Separated, entry+" -> "+name)
	if slices.Contains(a.Contents[path], entry) {
		a.Workspace.Put(destination, name)
	}
	return a.EntryRuns[entry], nil
}

type NameReader struct {
	Names map[string]scan.LegacyNames
	Err   error
}

func (n *NameReader) LegacyNames(_ context.Context, path string) (scan.LegacyNames, error) {
	return n.Names[path], n.Err
}

type Objects struct {
	Fetched []string
	Missing map[string]bool
	Err     error
}

func (o *Objects) Fetch(_ context.Context, key, path string) error {
	if o.Err != nil {
		return o.Err
	}
	if o.Missing[key] {
		return scan.ErrObjectMissing
	}
	o.Fetched = append(o.Fetched, key+" -> "+path)
	return nil
}

type DiscReader struct {
	Volumes map[string]scan.DiscVolume
	Sheets  map[string]scan.DiscSheet
	Cooked  map[string]string
}

func (d *DiscReader) Probe(_ context.Context, path string) (scan.DiscVolume, error) {
	return d.Volumes[path], nil
}

func (d *DiscReader) Cook(_ context.Context, path, target string) error {
	if d.Cooked == nil {
		d.Cooked = map[string]string{}
	}
	d.Cooked[target] = path
	return nil
}

func (d *DiscReader) Sheet(_ context.Context, path string, _ int64) (scan.DiscSheet, error) {
	return d.Sheets[path], nil
}

type KeptPreview struct {
	InspectionID int
	EntryID      int
	Kind         inspection.Preview
	Content      string
}

type Inspections struct {
	Drafts       []inspection.Draft
	Previews     []KeptPreview
	ClearedIDs   []int
	Err          error
	PreviewErr   error
	PreviewCalls int
}

func (i *Inspections) Record(_ context.Context, draft inspection.Draft) (inspection.Recorded, error) {
	if i.Err != nil {
		return inspection.Recorded{}, i.Err
	}
	i.Drafts = append(i.Drafts, draft)
	entries := make([]int, min(len(draft.Entries), inspection.EntryLimit))
	for index := range entries {
		entries[index] = len(i.Drafts)*1000 + index
	}
	return inspection.Recorded{ID: len(i.Drafts), Entries: entries}, nil
}

func (i *Inspections) KeepPreview(_ context.Context, inspectionID, entryID int, kind inspection.Preview, content io.Reader) error {
	i.PreviewCalls++
	if i.PreviewErr != nil {
		return i.PreviewErr
	}
	data, err := io.ReadAll(content)
	if err != nil {
		return err
	}
	i.Previews = append(i.Previews, KeptPreview{InspectionID: inspectionID, EntryID: entryID, Kind: kind, Content: string(data)})
	return nil
}

func (i *Inspections) Cleared(_ context.Context, ids []int) error {
	i.ClearedIDs = append(i.ClearedIDs, ids...)
	return nil
}

type Spool struct {
	Room int64
}

func (s *Spool) SpoolRoom(context.Context) (int64, error) {
	return s.Room, nil
}

type Scanner struct {
	Reports map[string]scan.Report
	Scanned []string
	Limit   int64
	Err     error
	Version scan.Engine
}

func (s *Scanner) MaxSize() int64 {
	return s.Limit
}

func (s *Scanner) Engine(context.Context) (scan.Engine, error) {
	return s.Version, s.Err
}

func (s *Scanner) Scan(_ context.Context, name string, content io.Reader) (scan.Report, error) {
	if s.Err != nil {
		return scan.Report{}, s.Err
	}
	if _, err := io.Copy(io.Discard, content); err != nil {
		return scan.Report{}, err
	}
	s.Scanned = append(s.Scanned, name)
	return s.Reports[name], nil
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
	Stalled    []scan.StalledAlert
}

func (m *Mailer) CheckStalled(_ context.Context, recipients []string, alert scan.StalledAlert) error {
	m.Recipients = append(m.Recipients, recipients)
	m.Stalled = append(m.Stalled, alert)
	return nil
}

func (m *Mailer) MalwareDetected(_ context.Context, recipients []string, alert scan.MalwareAlert) error {
	m.Recipients = append(m.Recipients, recipients)
	m.Alerts = append(m.Alerts, alert)
	return nil
}
