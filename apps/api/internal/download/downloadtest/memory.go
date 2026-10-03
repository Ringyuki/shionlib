package downloadtest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type MemoryRepository struct {
	mu            sync.Mutex
	now           func() time.Time
	nextResource  int
	nextFile      int
	nextHistory   int
	resources     map[int]download.Resource
	files         map[int]download.File
	histories     []download.History
	cases         map[int][]download.MalwareCaseRef
	favorites     map[int][]int
	uploading     map[int]bool
	ratedGames    map[int]bool
	Strikes       map[int]int
	GameDownloads map[int]int
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{
		now:           now,
		resources:     map[int]download.Resource{},
		files:         map[int]download.File{},
		cases:         map[int][]download.MalwareCaseRef{},
		favorites:     map[int][]int{},
		uploading:     map[int]bool{},
		ratedGames:    map[int]bool{},
		Strikes:       map[int]int{},
		GameDownloads: map[int]int{},
	}
}

func (r *MemoryRepository) SeedResource(res download.Resource) download.Resource {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextResource++
	res.ID = r.nextResource
	if res.Status == 0 {
		res.Status = download.ResourceActive
	}
	if res.Created.IsZero() {
		res.Created = r.now()
	}
	if res.Updated.IsZero() {
		res.Updated = res.Created
	}
	r.resources[res.ID] = res
	return res
}

func (r *MemoryRepository) SeedFile(file download.File) download.File {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextFile++
	file.ID = r.nextFile
	if file.Type == 0 {
		file.Type = download.FileTypeObjectStore
	}
	if file.HashAlgorithm == "" {
		file.HashAlgorithm = upload.HashBLAKE3
	}
	file.Created, file.Updated = r.now(), r.now()
	r.files[file.ID] = file
	return r.decorate(file)
}

func (r *MemoryRepository) SeedHistory(h download.History) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextHistory++
	h.ID = r.nextHistory
	if h.Created.IsZero() {
		h.Created = r.now()
	}
	r.histories = append(r.histories, h)
}

func (r *MemoryRepository) SeedMalwareCase(fileID int, ref download.MalwareCaseRef) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cases[fileID] = append(r.cases[fileID], ref)
}

func (r *MemoryRepository) SeedFavorite(gameID, userID int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.favorites[gameID] = append(r.favorites[gameID], userID)
}

func (r *MemoryRepository) MarkUploading(userID int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.uploading[userID] = true
}

func (r *MemoryRepository) MarkRated(gameID int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.ratedGames[gameID] = true
}

func (r *MemoryRepository) Histories(fileID int) []download.History {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []download.History
	for _, h := range r.histories {
		if h.FileID == fileID {
			out = append(out, h)
		}
	}
	return out
}

func (r *MemoryRepository) decorate(file download.File) download.File {
	resource := r.resources[file.ResourceID]
	file.GameID = resource.GameID
	file.ResourceStatus = resource.Status
	return file
}

func (r *MemoryRepository) summary(id int) user.Summary {
	return user.Summary{ID: id, Name: "user" + string(rune('0'+id%10))}
}

func (r *MemoryRepository) filesOf(resourceID int) []download.File {
	var out []download.File
	for _, file := range r.files {
		if file.ResourceID == resourceID {
			out = append(out, r.decorate(file))
		}
	}
	slices.SortFunc(out, func(a, b download.File) int { return cmp.Compare(a.ID, b.ID) })
	return out
}

func (r *MemoryRepository) ListGameResources(_ context.Context, gameID int) ([]download.GameResource, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []download.GameResource
	for _, resource := range r.sortedResources() {
		if resource.GameID != gameID || resource.Status != download.ResourceActive {
			continue
		}
		item := download.GameResource{Resource: resource, Creator: r.summary(resource.CreatorID)}
		for _, file := range r.filesOf(resource.ID) {
			item.Files = append(item.Files, download.GameFile{File: file, MalwareCases: slices.Clone(r.cases[file.ID]), Creator: r.summary(file.CreatorID), RecentHistory: r.recentHistory(file.ID)})
		}
		out = append(out, item)
	}
	return out, nil
}

func (r *MemoryRepository) recentHistory(fileID int) []download.HistoryRef {
	var refs []download.HistoryRef
	for i := len(r.histories) - 1; i >= 0 && len(refs) < 2; i-- {
		h := r.histories[i]
		if h.FileID == fileID {
			refs = append(refs, download.HistoryRef{ID: h.ID, Reason: h.Reason, Created: h.Created, OperatorID: h.OperatorID})
		}
	}
	return refs
}

func (r *MemoryRepository) sortedResources() []download.Resource {
	out := make([]download.Resource, 0, len(r.resources))
	for _, resource := range r.resources {
		out = append(out, resource)
	}
	slices.SortFunc(out, func(a, b download.Resource) int { return cmp.Compare(a.ID, b.ID) })
	return out
}

func (r *MemoryRepository) listed(keep func(download.Resource) bool, excludeRated bool, page download.Page) ([]download.Resource, int) {
	var matched []download.Resource
	for _, resource := range r.sortedResources() {
		if resource.Status != download.ResourceActive || !keep(resource) || (excludeRated && r.ratedGames[resource.GameID]) {
			continue
		}
		matched = append(matched, resource)
	}
	slices.Reverse(matched)
	total := len(matched)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	return matched[start:end], total
}

func (r *MemoryRepository) names(resourceID int) []string {
	var names []string
	for _, file := range r.filesOf(resourceID) {
		names = append(names, file.Name)
	}
	return names
}

func (r *MemoryRepository) ListReleases(_ context.Context, excludeRated bool, page download.Page) ([]download.Release, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	resources, total := r.listed(func(download.Resource) bool { return true }, excludeRated, page)
	out := make([]download.Release, len(resources))
	for i, resource := range resources {
		names := r.names(resource.ID)
		out[i] = download.Release{Resource: resource, FileNames: names, FilesCount: len(names), Creator: r.summary(resource.CreatorID)}
	}
	return out, total, nil
}

func (r *MemoryRepository) ListUserResources(_ context.Context, creatorID int, excludeRated bool, page download.Page) ([]download.UserResource, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	resources, total := r.listed(func(res download.Resource) bool { return res.CreatorID == creatorID }, excludeRated, page)
	out := make([]download.UserResource, len(resources))
	for i, resource := range resources {
		names := r.names(resource.ID)
		out[i] = download.UserResource{Resource: resource, FileNames: names, FilesCount: len(names), Creator: r.summary(resource.CreatorID)}
	}
	return out, total, nil
}

func (r *MemoryRepository) HasUploadingSession(_ context.Context, userID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.uploading[userID], nil
}

func (r *MemoryRepository) ResourceUsesSession(_ context.Context, gameID, sessionID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, resource := range r.resources {
		if resource.GameID == gameID && resource.UploadSessionID != nil && *resource.UploadSessionID == sessionID {
			return true, nil
		}
	}
	return false, nil
}

func (r *MemoryRepository) CreateResource(_ context.Context, in download.NewResource) (download.Resource, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextResource++
	resource := download.Resource{
		ID:              r.nextResource,
		GameID:          in.GameID,
		Status:          download.ResourceActive,
		Platforms:       slices.Clone(in.Platforms),
		Languages:       slices.Clone(in.Languages),
		Simulator:       in.Simulator,
		Note:            in.Note,
		UploadSessionID: in.UploadSessionID,
		CreatorID:       in.CreatorID,
		Created:         r.now(),
		Updated:         r.now(),
	}
	r.resources[resource.ID] = resource
	return resource, nil
}

func (r *MemoryRepository) CreateFile(_ context.Context, in download.NewFile) (download.File, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.resources[in.ResourceID]; !ok {
		return download.File{}, download.ErrResourceNotFound
	}
	for _, file := range r.files {
		if in.UploadSessionID != nil && file.UploadSessionID != nil && *file.UploadSessionID == *in.UploadSessionID {
			return download.File{}, upload.ErrSessionAlreadyUsed
		}
	}
	r.nextFile++
	file := download.File{
		ID:              r.nextFile,
		ResourceID:      in.ResourceID,
		Type:            in.Type,
		Name:            in.Name,
		Path:            in.Path,
		Size:            in.Size,
		StorageKey:      in.StorageKey,
		ContentType:     in.ContentType,
		HashAlgorithm:   in.HashAlgorithm,
		Hash:            in.Hash,
		UploadSessionID: in.UploadSessionID,
		Status:          in.Status,
		CreatorID:       in.CreatorID,
		Created:         r.now(),
		Updated:         r.now(),
	}
	r.files[file.ID] = file
	return r.decorate(file), nil
}

func (r *MemoryRepository) GetResource(_ context.Context, id int) (download.Resource, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	resource, ok := r.resources[id]
	if !ok {
		return download.Resource{}, download.ErrResourceNotFound
	}
	return resource, nil
}

func (r *MemoryRepository) LockResource(ctx context.Context, id int) (download.Resource, error) {
	return r.GetResource(ctx, id)
}

func (r *MemoryRepository) UpdateResource(_ context.Context, id int, changes download.ResourceChanges) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	resource, ok := r.resources[id]
	if !ok {
		return download.ErrResourceNotFound
	}
	resource.Platforms = slices.Clone(changes.Platforms)
	resource.Languages = slices.Clone(changes.Languages)
	resource.Simulator = changes.Simulator
	if changes.Note != nil {
		resource.Note = changes.Note
	}
	r.resources[id] = resource
	if changes.FileName != nil {
		for fileID, file := range r.files {
			if file.ResourceID == id {
				file.Name = *changes.FileName
				r.files[fileID] = file
			}
		}
	}
	return nil
}

func (r *MemoryRepository) SetResourceStatus(_ context.Context, id, status int, updated time.Time) error {
	return r.mutateResource(id, func(res *download.Resource) {
		res.Status = status
		res.Updated = updated
	})
}

func (r *MemoryRepository) TouchResource(_ context.Context, id int, updated time.Time) error {
	return r.mutateResource(id, func(res *download.Resource) { res.Updated = updated })
}

func (r *MemoryRepository) DeleteResource(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.resources[id]; !ok {
		return download.ErrResourceNotFound
	}
	delete(r.resources, id)
	for fileID, file := range r.files {
		if file.ResourceID == id {
			delete(r.files, fileID)
		}
	}
	return nil
}

func (r *MemoryRepository) CountDownload(_ context.Context, resourceID, gameID int) error {
	r.GameDownloads[gameID]++
	return r.mutateResource(resourceID, func(res *download.Resource) { res.Downloads++ })
}

func (r *MemoryRepository) ListFiles(_ context.Context, resourceID int) ([]download.File, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.filesOf(resourceID), nil
}

func (r *MemoryRepository) CountFiles(_ context.Context, resourceID int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.filesOf(resourceID)), nil
}

func (r *MemoryRepository) GetFile(_ context.Context, id int) (download.File, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	file, ok := r.files[id]
	if !ok {
		return download.File{}, download.ErrFileNotFound
	}
	return r.decorate(file), nil
}

func (r *MemoryRepository) LockFile(ctx context.Context, id int) (download.File, error) {
	return r.GetFile(ctx, id)
}

func (r *MemoryRepository) FindFileBySession(_ context.Context, sessionID int) (download.File, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, file := range r.files {
		if file.UploadSessionID != nil && *file.UploadSessionID == sessionID {
			return r.decorate(file), true, nil
		}
	}
	return download.File{}, false, nil
}

func (r *MemoryRepository) ReplaceFileContent(_ context.Context, id int, content download.FileContent) error {
	return r.mutateFile(id, func(f *download.File) {
		path, session := content.Path, content.UploadSessionID
		f.Path = &path
		f.Size = content.Size
		f.Hash = content.Hash
		f.HashAlgorithm = content.HashAlgorithm
		f.ContentType = content.ContentType
		f.Status = download.FileOnServer
		f.CheckStatus = download.CheckPending
		f.FalsePositive = false
		f.StorageKey = nil
		f.UploadSessionID = &session
	})
}

func (r *MemoryRepository) MarkFileStored(_ context.Context, id int, key string) error {
	return r.mutateFile(id, func(f *download.File) {
		f.Status = download.FileInObjectStore
		f.StorageKey = &key
	})
}

func (r *MemoryRepository) ClearFilePath(_ context.Context, id int) error {
	return r.mutateFile(id, func(f *download.File) { f.Path = nil })
}

func (r *MemoryRepository) DeleteFile(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.files[id]; !ok {
		return download.ErrFileNotFound
	}
	delete(r.files, id)
	return nil
}

func (r *MemoryRepository) filtered(keep func(download.File) bool, limit int) []download.File {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []download.File
	for _, file := range r.files {
		if keep(file) {
			out = append(out, r.decorate(file))
		}
	}
	slices.SortFunc(out, func(a, b download.File) int { return cmp.Compare(a.ID, b.ID) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

func (r *MemoryRepository) ListStoredWithLocalCopy(_ context.Context, limit int) ([]download.File, error) {
	return r.filtered(func(f download.File) bool {
		return f.Type == download.FileTypeObjectStore && f.Status == download.FileInObjectStore && f.Path != nil
	}, limit), nil
}

func (r *MemoryRepository) ListRejected(_ context.Context, limit int) ([]download.File, error) {
	return r.filtered(func(f download.File) bool {
		return f.Type == download.FileTypeObjectStore && f.Status == download.FileOnServer && f.CheckStatus.Rejected()
	}, limit), nil
}

func (r *MemoryRepository) CreateHistory(_ context.Context, in download.NewHistory) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextHistory++
	r.histories = append(r.histories, download.History{
		ID:              r.nextHistory,
		FileID:          in.FileID,
		Size:            in.Size,
		HashAlgorithm:   in.HashAlgorithm,
		Hash:            in.Hash,
		StorageKey:      in.StorageKey,
		Reason:          in.Reason,
		UploadSessionID: in.UploadSessionID,
		OperatorID:      in.OperatorID,
		Created:         r.now(),
	})
	return nil
}

func (r *MemoryRepository) LatestHistory(_ context.Context, fileID int) (download.History, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := len(r.histories) - 1; i >= 0; i-- {
		if r.histories[i].FileID == fileID {
			return r.histories[i], true, nil
		}
	}
	return download.History{}, false, nil
}

func (r *MemoryRepository) SetHistoryStorageKey(_ context.Context, id int, key string) error {
	return r.mutateHistory(id, func(h *download.History) { h.StorageKey = &key })
}

func (r *MemoryRepository) ListHistory(_ context.Context, fileID int) ([]download.HistoryEntry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []download.HistoryEntry{}
	for i := len(r.histories) - 1; i >= 0; i-- {
		if h := r.histories[i]; h.FileID == fileID {
			out = append(out, download.HistoryEntry{History: h, Operator: r.summary(h.OperatorID)})
		}
	}
	return out, nil
}

func (r *MemoryRepository) GetHistory(_ context.Context, id int) (download.History, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, h := range r.histories {
		if h.ID == id {
			return h, nil
		}
	}
	return download.History{}, download.ErrFileNotFound
}

func (r *MemoryRepository) SetHistoryReason(_ context.Context, id int, reason *string) error {
	return r.mutateHistory(id, func(h *download.History) { h.Reason = reason })
}

func (r *MemoryRepository) FavoriteReceivers(_ context.Context, gameID, excludeUserID int) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []int
	for _, userID := range r.favorites[gameID] {
		if userID != excludeUserID && !slices.Contains(out, userID) {
			out = append(out, userID)
		}
	}
	slices.Sort(out)
	return out, nil
}

func (r *MemoryRepository) ResetMalwareStrikes(_ context.Context, userID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Strikes[userID] = 0
	return nil
}

func (r *MemoryRepository) mutateResource(id int, fn func(*download.Resource)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	resource, ok := r.resources[id]
	if !ok {
		return download.ErrResourceNotFound
	}
	fn(&resource)
	r.resources[id] = resource
	return nil
}

func (r *MemoryRepository) mutateFile(id int, fn func(*download.File)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	file, ok := r.files[id]
	if !ok {
		return download.ErrFileNotFound
	}
	fn(&file)
	file.Updated = r.now()
	r.files[id] = file
	return nil
}

func (r *MemoryRepository) mutateHistory(id int, fn func(*download.History)) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := range r.histories {
		if r.histories[i].ID == id {
			fn(&r.histories[i])
			return nil
		}
	}
	return download.ErrFileNotFound
}
