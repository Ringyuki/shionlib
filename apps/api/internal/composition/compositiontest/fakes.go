package compositiontest

import (
	"context"
	"errors"
	"fmt"
	"path"
	"slices"
	"strings"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const StageRoot = "/spool/.compose"

type Bases struct {
	Resources map[int]download.GameResource
}

func (b *Bases) OfGame(_ context.Context, _ actor.Actor, gameID int) ([]download.GameResource, error) {
	found := []download.GameResource{}
	for _, resource := range b.Resources {
		if resource.GameID == gameID {
			found = append(found, resource)
		}
	}
	slices.SortFunc(found, func(a, c download.GameResource) int { return a.ID - c.ID })
	return found, nil
}

func (b *Bases) Stored(_ context.Context, resourceID int) (download.GameResource, error) {
	resource, ok := b.Resources[resourceID]
	if !ok {
		return download.GameResource{}, download.ErrResourceNotFound
	}
	return resource, nil
}

type Listings struct {
	Inspections map[int]inspection.Inspection
	Paths       map[int][]inspection.FilePath
}

func (l *Listings) Facts(_ context.Context, ids []int) (map[int]inspection.Inspection, error) {
	facts := map[int]inspection.Inspection{}
	for _, id := range ids {
		if found, ok := l.Inspections[id]; ok {
			facts[id] = found
		}
	}
	return facts, nil
}

func (l *Listings) Files(_ context.Context, inspectionID int) ([]inspection.FilePath, error) {
	return slices.Clone(l.Paths[inspectionID]), nil
}

type Uploads struct {
	Sessions map[int]upload.Session
	Stage    *Stage
	Taken    []int
}

func (u *Uploads) Take(_ context.Context, who actor.Actor, sessionID int, target string) (upload.Session, error) {
	session, ok := u.Sessions[sessionID]
	switch {
	case !ok:
		return upload.Session{}, upload.ErrSessionNotFound
	case session.Status != upload.StatusCompleted:
		return upload.Session{}, upload.ErrInvalidSessionStatus
	case session.CreatorID != who.UserID:
		return upload.Session{}, upload.ErrSessionNotOwner
	}
	session.Status = upload.StatusExpired
	u.Sessions[sessionID] = session
	u.Taken = append(u.Taken, sessionID)
	u.Stage.Put(target, session.TotalSize)
	return session, nil
}

type Quota struct {
	Allowances map[int]upload.Allowance
}

func (q *Quota) Allowance(_ context.Context, userID int) (upload.Allowance, error) {
	return q.Allowances[userID], nil
}

type Spool struct {
	Room int64
}

func (s *Spool) SpoolRoom(context.Context) (int64, error) {
	return s.Room, nil
}

type Examiner struct {
	Findings map[string]scan.LocalFinding
	Err      error
	Examined []scan.LocalFile
	Recorded []string
	Off      bool
}

func (e *Examiner) Checking() bool {
	return !e.Off
}

func (e *Examiner) Examine(_ context.Context, file scan.LocalFile, record bool) (scan.LocalFinding, error) {
	if e.Err != nil {
		return scan.LocalFinding{}, e.Err
	}
	e.Examined = append(e.Examined, file)
	finding, ok := e.Findings[path.Base(file.Path)]
	if !ok {
		finding = scan.LocalFinding{Status: download.CheckOK, Format: "7z", Container: true, SHA256: "sha-" + path.Base(file.Path)}
	}
	if record && !finding.Infected() && finding.Status == download.CheckOK {
		e.Recorded = append(e.Recorded, file.Path)
		finding.InspectionID = 900 + len(e.Recorded)
	}
	return finding, nil
}

type Resources struct {
	mu        sync.Mutex
	next      int
	Begun     []download.ComposedDraft
	Files     map[int]download.GameResource
	Published []download.ComposedFile
	Replaced  []download.ComposedReplacement
	Discarded []int
	Err       error
}

func (r *Resources) Begin(_ context.Context, who actor.Actor, draft download.ComposedDraft) (download.Resource, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if draft.Info.Translation == nil && download.Translated(draft.Languages) {
		return download.Resource{}, errors.New("a translation must say where it comes from")
	}
	r.next++
	r.Begun = append(r.Begun, draft)
	return download.Resource{ID: 500 + r.next, GameID: draft.GameID, CreatorID: who.UserID, Status: download.ResourceActive}, nil
}

func (r *Resources) Owned(_ context.Context, who actor.Actor, resourceID int) (download.GameResource, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	resource, ok := r.Files[resourceID]
	if !ok {
		return download.GameResource{}, download.ErrResourceNotFound
	}
	if resource.CreatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
		return download.GameResource{}, download.ErrResourceNotOwner
	}
	return resource, nil
}

func (r *Resources) Publish(_ context.Context, file download.ComposedFile) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.Err != nil {
		return r.Err
	}
	r.Published = append(r.Published, file)
	return nil
}

func (r *Resources) Replace(_ context.Context, file download.ComposedReplacement) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.Err != nil {
		return r.Err
	}
	r.Replaced = append(r.Replaced, file)
	return nil
}

func (r *Resources) Discard(_ context.Context, resourceID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Discarded = append(r.Discarded, resourceID)
	return nil
}

type Names struct{}

func (Names) Preview(_ context.Context, in download.NamePreview) (download.FileName, error) {
	parts := []string{fmt.Sprintf("game%d", in.GameID)}
	parts = append(parts, in.Info.Translators...)
	if in.Info.PatchVersion != nil {
		parts = append(parts, *in.Info.PatchVersion)
	}
	return download.FileName{Before: strings.Join(parts, " "), After: in.Uploaded}, nil
}

type Patches struct {
	ByDigest map[string]moyu.Entry
	Err      error
}

func (p *Patches) ByHash(_ context.Context, _ actor.Actor, _ int, sha256 string) (moyu.Entry, bool, error) {
	if p.Err != nil {
		return moyu.Entry{}, false, p.Err
	}
	entry, ok := p.ByDigest[sha256]
	return entry, ok, nil
}

type Objects struct {
	Stage   *Stage
	Sizes   map[string]int64
	Missing map[string]bool
	Err     error
	Fetched []string
}

func (o *Objects) Download(_ context.Context, key, target string, observe func(done int64)) error {
	switch {
	case o.Err != nil:
		return o.Err
	case o.Missing[key]:
		return scan.ErrObjectMissing
	}
	o.Fetched = append(o.Fetched, key)
	size := o.Sizes[key]
	observe(size / 2)
	observe(size)
	o.Stage.Put(target, size)
	return nil
}

type Archiver struct {
	Stage      *Stage
	Contents   map[string][]composition.Node
	Unreadable map[string]bool
	Err        error
	Unpacked   []composition.Unpacking
	Packed     []composition.Packing
}

func (a *Archiver) Unpack(_ context.Context, in composition.Unpacking, observe func(percent int)) error {
	name := path.Base(in.Archive)
	switch {
	case a.Err != nil:
		return a.Err
	case a.Unreadable[name]:
		return fmt.Errorf("unpack %s: %w", name, composition.ErrUnreadable)
	case !a.Stage.Has(in.Archive):
		return fmt.Errorf("unpack %s: the archive is not on disk", in.Archive)
	}
	a.Unpacked = append(a.Unpacked, in)
	observe(50)
	for _, node := range a.Contents[name] {
		target := path.Join(in.Destination, node.Path)
		if node.Dir {
			a.Stage.MakeDir(target)
			continue
		}
		a.Stage.Put(target, node.Size)
	}
	a.Stage.MakeDir(in.Destination)
	observe(100)
	return nil
}

func (a *Archiver) Pack(ctx context.Context, in composition.Packing, observe func(percent int)) error {
	if a.Err != nil {
		return a.Err
	}
	a.Packed = append(a.Packed, in)
	var size int64
	for _, entry := range in.Entries {
		part, err := a.Stage.Size(ctx, path.Join(in.Root, entry))
		if err != nil {
			return err
		}
		size += part
	}
	observe(100)
	a.Stage.Put(in.Target, size)
	return nil
}

type Recorder struct {
	mu       sync.Mutex
	messages []message.NewMessage
	jobs     []composition.Job
}

func (r *Recorder) Send(_ context.Context, in message.NewMessage) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.messages = append(r.messages, in)
	return nil
}

func (r *Recorder) Enqueue(_ context.Context, job composition.Job) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.jobs = append(r.jobs, job)
	return nil
}

func (r *Recorder) Messages() []message.NewMessage {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.messages)
}

func (r *Recorder) Jobs() []composition.Job {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.jobs)
}
