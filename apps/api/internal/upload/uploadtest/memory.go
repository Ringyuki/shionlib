package uploadtest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type MemoryRepository struct {
	mu       sync.Mutex
	now      func() time.Time
	nextID   int
	sessions map[int]upload.Session
	attached map[int]bool
	paths    map[string]bool
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{now: now, sessions: map[int]upload.Session{}, attached: map[int]bool{}, paths: map[string]bool{}}
}

func (r *MemoryRepository) Seed(s upload.Session) upload.Session {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	s.ID = r.nextID
	if s.Created.IsZero() {
		s.Created = r.now()
	}
	if s.Updated.IsZero() {
		s.Updated = s.Created
	}
	r.sessions[s.ID] = s
	return s
}

func (r *MemoryRepository) AttachFile(sessionID int, path string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.attached[sessionID] = true
	r.paths[path] = true
}

func (r *MemoryRepository) CreateSession(_ context.Context, in upload.NewSession) (upload.Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	now := r.now()
	session := upload.Session{
		ID:             r.nextID,
		FileName:       in.FileName,
		TotalSize:      in.TotalSize,
		ChunkSize:      in.ChunkSize,
		TotalChunks:    in.TotalChunks,
		UploadedChunks: []int{},
		HashAlgorithm:  upload.HashBLAKE3,
		FileHash:       in.FileHash,
		Status:         upload.StatusUploading,
		StoragePath:    in.StoragePath,
		ExpiresAt:      in.ExpiresAt,
		CreatorID:      in.CreatorID,
		Created:        now,
		Updated:        now,
	}
	r.sessions[session.ID] = session
	return session, nil
}

func (r *MemoryRepository) SetStoragePath(_ context.Context, id int, path string) error {
	return r.mutate(id, func(s *upload.Session) bool {
		s.StoragePath = path
		return true
	})
}

func (r *MemoryRepository) GetSession(_ context.Context, id int) (upload.Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	session, ok := r.sessions[id]
	if !ok {
		return upload.Session{}, upload.ErrSessionNotFound
	}
	session.UploadedChunks = slices.Clone(session.UploadedChunks)
	return session, nil
}

func (r *MemoryRepository) LockSession(ctx context.Context, id int) (upload.Session, error) {
	return r.GetSession(ctx, id)
}

func (r *MemoryRepository) ListUploading(_ context.Context, creatorID int, now time.Time, limit int) ([]upload.Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []upload.Session{}
	for _, session := range r.sessions {
		if session.CreatorID == creatorID && session.Status == upload.StatusUploading && !session.ExpiresAt.Before(now) {
			out = append(out, session)
		}
	}
	slices.SortFunc(out, func(a, b upload.Session) int { return cmp.Compare(a.ID, b.ID) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (r *MemoryRepository) AddChunk(_ context.Context, id, index int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	session, ok := r.sessions[id]
	if !ok || slices.Contains(session.UploadedChunks, index) {
		return nil
	}
	session.UploadedChunks = append(slices.Clone(session.UploadedChunks), index)
	session.Updated = r.now()
	r.sessions[id] = session
	return nil
}

func (r *MemoryRepository) SetStatus(_ context.Context, id int, from, to upload.SessionStatus, mimeType *string) (bool, error) {
	changed := false
	missing := r.mutate(id, func(s *upload.Session) bool {
		if s.Status != from {
			return false
		}
		s.Status = to
		if mimeType != nil {
			value := *mimeType
			s.MimeType = &value
		}
		changed = true
		return true
	})
	return changed && missing == nil, nil
}

func (r *MemoryRepository) ListStale(_ context.Context, before time.Time, limit int) ([]upload.Session, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []upload.Session{}
	for _, session := range r.sessions {
		stale := false
		switch session.Status {
		case upload.StatusAborted:
			stale = true
		case upload.StatusUploading:
			stale = session.ExpiresAt.Before(before)
		case upload.StatusCompleted:
			stale = session.Updated.Before(before) && !r.attached[session.ID]
		}
		if stale {
			out = append(out, session)
		}
	}
	slices.SortFunc(out, func(a, b upload.Session) int { return cmp.Compare(a.ID, b.ID) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (r *MemoryRepository) HasFile(_ context.Context, sessionID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.attached[sessionID], nil
}

func (r *MemoryRepository) ReferencedPaths(_ context.Context, paths []string) (map[string]bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := map[string]bool{}
	for _, path := range paths {
		if r.paths[path] {
			out[path] = true
			continue
		}
		for _, session := range r.sessions {
			live := session.Status == upload.StatusUploading || session.Status == upload.StatusCompleted
			if live && session.StoragePath == path {
				out[path] = true
			}
		}
	}
	return out, nil
}

func (r *MemoryRepository) mutate(id int, fn func(*upload.Session) bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	session, ok := r.sessions[id]
	if !ok {
		return upload.ErrSessionNotFound
	}
	if fn(&session) {
		session.Updated = r.now()
		r.sessions[id] = session
	}
	return nil
}
