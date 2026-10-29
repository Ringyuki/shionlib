package composition

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Deps struct {
	Repo      Repository
	Bases     Bases
	Listings  Listings
	Uploads   Uploads
	Quota     Quota
	Spool     Spool
	Examiner  Examiner
	Resources Resources
	Names     Names
	Games     Games
	Patches   Patches
	Objects   Objects
	Archiver  Archiver
	Stage     Stage
	Messages  Messenger
	Queue     Queue
	Tx        Transactor
	Settings  setting.Source
	Now       func() time.Time
}

type Service struct {
	repo      Repository
	bases     Bases
	listings  Listings
	uploads   Uploads
	quota     Quota
	examiner  Examiner
	resources Resources
	names     Names
	games     Games
	stage     Stage
	queue     Queue
	tx        Transactor
	settings  setting.Source
	now       func() time.Time
}

func NewService(deps Deps) *Service {
	return &Service{
		repo:      deps.Repo,
		bases:     deps.Bases,
		listings:  deps.Listings,
		uploads:   deps.Uploads,
		quota:     deps.Quota,
		examiner:  deps.Examiner,
		resources: deps.Resources,
		names:     deps.Names,
		games:     deps.Games,
		stage:     deps.Stage,
		queue:     deps.Queue,
		tx:        deps.Tx,
		settings:  deps.Settings,
		now:       deps.Now,
	}
}

func (s *Service) Candidates(ctx context.Context, who actor.Actor, gameID int) ([]Candidate, error) {
	resources, err := s.bases.OfGame(ctx, who, gameID)
	if err != nil {
		return nil, err
	}
	ids := make([]int, len(resources))
	for i, resource := range resources {
		ids[i] = resource.ID
	}
	composed, err := s.repo.Composed(ctx, ids)
	if err != nil {
		return nil, err
	}
	facts, err := s.listings.Facts(ctx, Inspections(resources))
	if err != nil {
		return nil, err
	}
	limit := MaxUnpackedSize.Read(s.settings)
	candidates := make([]Candidate, len(resources))
	for i, resource := range resources {
		base, reason := BaseOf(resource, facts, limit)
		if slices.Contains(composed, resource.ID) {
			made := UnusableComposed
			reason = &made
		}
		candidates[i] = Candidate{Resource: resource, Base: base, Reason: reason}
	}
	return candidates, nil
}

func (s *Service) usable(ctx context.Context, resourceID int) (download.GameResource, Base, error) {
	resource, err := s.bases.Stored(ctx, resourceID)
	if errors.Is(err, download.ErrResourceNotFound) {
		return download.GameResource{}, Base{}, ErrBaseGone
	}
	if err != nil {
		return download.GameResource{}, Base{}, err
	}
	facts, err := s.listings.Facts(ctx, Inspections([]download.GameResource{resource}))
	if err != nil {
		return download.GameResource{}, Base{}, err
	}
	base, reason := BaseOf(resource, facts, MaxUnpackedSize.Read(s.settings))
	if reason != nil {
		return download.GameResource{}, Base{}, ErrBaseUnusable.WithArgs(map[string]any{"reason": string(*reason)})
	}
	return resource, base, nil
}

func (s *Service) Begin(ctx context.Context, who actor.Actor, gameID, baseResourceID int) (View, error) {
	if !s.examiner.Checking() {
		return View{}, ErrChecksOff
	}
	resource, base, err := s.usable(ctx, baseResourceID)
	if err != nil {
		return View{}, err
	}
	if resource.GameID != gameID {
		return View{}, ErrBaseGone
	}
	composed, err := s.repo.Composed(ctx, []int{resource.ID})
	if err != nil {
		return View{}, err
	}
	if len(composed) > 0 {
		return View{}, ErrBaseUnusable.WithArgs(map[string]any{"reason": string(UnusableComposed)})
	}
	created, err := s.repo.Create(ctx, NewComposition{GameID: gameID, CreatorID: who.UserID, Base: base, KeepPatch: true})
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, created)
}

func (s *Service) Get(ctx context.Context, who actor.Actor, id int) (View, error) {
	found, err := s.owned(ctx, who, id)
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, found)
}

func (s *Service) Active(ctx context.Context, who actor.Actor) ([]View, error) {
	found, err := s.repo.ListActive(ctx, who.UserID, activeListLimit)
	if err != nil {
		return nil, err
	}
	views := make([]View, len(found))
	for i, one := range found {
		if views[i], err = s.view(ctx, who, one); err != nil {
			return nil, err
		}
	}
	return views, nil
}

func (s *Service) Lineage(ctx context.Context, viewer actor.Actor, resourceID int) (Lineage, error) {
	found, err := s.repo.OfResource(ctx, resourceID)
	if err != nil || len(found) == 0 {
		return Lineage{}, err
	}
	var lineage Lineage
	for i, one := range found {
		if one.State == StateDone && lineage.Latest == nil {
			lineage.Latest = &found[i]
		}
	}
	current := found[0]
	if current.State == StateDone || !mine(viewer, current) {
		return lineage, s.baseState(ctx, &lineage)
	}
	view, err := s.view(ctx, viewer, current)
	if err != nil {
		return Lineage{}, err
	}
	lineage.Current = &view
	return lineage, s.baseState(ctx, &lineage)
}

func (s *Service) baseState(ctx context.Context, lineage *Lineage) error {
	if lineage.Latest == nil {
		return nil
	}
	_, err := s.bases.Stored(ctx, lineage.Latest.Base.ResourceID)
	if errors.Is(err, download.ErrResourceNotFound) {
		lineage.BaseGone = true
		return nil
	}
	return err
}

func mine(who actor.Actor, composition Composition) bool {
	return who.Authenticated() && (composition.CreatorID == who.UserID || who.AtLeast(actor.RoleAdmin))
}

func (s *Service) owned(ctx context.Context, who actor.Actor, id int) (Composition, error) {
	found, err := s.repo.Get(ctx, id)
	if err != nil {
		return Composition{}, err
	}
	if !mine(who, found) {
		return Composition{}, ErrNotOwner
	}
	return found, nil
}

func (s *Service) locked(ctx context.Context, who actor.Actor, id int) (Composition, error) {
	found, err := s.repo.Lock(ctx, id)
	if err != nil {
		return Composition{}, err
	}
	if !mine(who, found) {
		return Composition{}, ErrNotOwner
	}
	return found, nil
}

func (s *Service) view(ctx context.Context, who actor.Actor, composition Composition) (View, error) {
	view := View{Composition: composition, Steps: composition.Progress(s.now())}
	if composition.Plan != nil {
		view.Folders = composition.Layout(composition.Plan.Folder)
	}
	view.FileName = composition.OutputName
	if composition.State == StateDraft {
		name, err := s.fileName(ctx, composition)
		if err != nil {
			return View{}, err
		}
		view.FileName = name
		discardAt := composition.Updated.Add(DraftTTL.Read(s.settings))
		view.DiscardAt = &discardAt
	}
	if composition.State == StateQueued {
		ahead, err := s.repo.Ahead(ctx, composition.ID)
		if err != nil {
			return View{}, err
		}
		view.Ahead = ahead
	}
	return view, nil
}

func (s *Service) fileName(ctx context.Context, composition Composition) (string, error) {
	if len(composition.Details.Languages) == 0 {
		return "", nil
	}
	portable := download.FormPortable
	name, err := s.names.Preview(ctx, download.NamePreview{
		GameID:    composition.GameID,
		Languages: composition.Details.Languages,
		Info: download.InfoInput{
			Translation:  composition.Details.Translation,
			Translators:  composition.Details.Translators,
			PatchVersion: composition.Details.PatchVersion,
			ReleaseURL:   composition.Details.ReleaseURL,
			Form:         &portable,
			Extras:       composition.Extras(),
		},
		Uploaded: OutputSuffix,
	})
	if err != nil {
		return "", err
	}
	return download.SafeSegment(name.String()), nil
}

func (s *Service) draw(ctx context.Context, who actor.Actor, composition *Composition) error {
	composition.Plan = nil
	if !composition.Patch.Ready() || composition.Base.InspectionID == 0 {
		return nil
	}
	listed, err := s.listings.Files(ctx, composition.Base.InspectionID)
	if err != nil {
		return err
	}
	base := make([]Entry, len(listed))
	for i, file := range listed {
		base[i] = Entry{Path: CleanPath(file.Path), Size: file.Size}
	}
	patch, err := s.repo.Entries(ctx, composition.ID, RolePatch)
	if err != nil {
		return err
	}
	plan := Draw(base, patch, composition.Placement)
	folder, wrapped := WrapperOf(base)
	if !wrapped {
		if folder, err = s.title(ctx, who, composition.GameID); err != nil {
			return err
		}
	}
	plan.Folder = folder
	composition.Plan = &plan
	return nil
}

func (s *Service) title(ctx context.Context, who actor.Actor, gameID int) (string, error) {
	cards, err := s.games.ByIDs(ctx, []int{gameID}, who)
	if err != nil {
		return "", err
	}
	title := download.SafeSegment(download.SourceOf(cards[gameID]).Title)
	if title == "" {
		title = untitledFolder
	}
	return title, nil
}

func (s *Service) touch(composition *Composition) time.Time {
	now := s.now()
	composition.Updated = now
	return now
}

func (s *Service) Attach(ctx context.Context, who actor.Actor, id int, role Role, upload Upload) (View, error) {
	var attached Composition
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		composition, err := s.draft(ctx, who, id)
		if err != nil {
			return err
		}
		if err := s.receive(ctx, who, &composition, role, upload); err != nil {
			return err
		}
		attached = composition
		return s.repo.Save(ctx, composition)
	})
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, attached)
}

func (s *Service) receive(ctx context.Context, who actor.Actor, composition *Composition, role Role, upload Upload) error {
	dir, err := s.stage.Open(ctx, composition.ID)
	if err != nil {
		return err
	}
	if previous := composition.input(role); previous != nil {
		if err := s.stage.Remove(ctx, previous.Path); err != nil {
			return err
		}
	}
	name := inputName(upload.Name)
	if name == "" {
		name = string(role)
	}
	target := filepath.Join(dir, inputsDir, string(role), name)
	session, err := s.uploads.Take(ctx, who, upload.SessionID, target, composition.ID)
	if err != nil {
		return err
	}
	composition.setInput(role, &Input{Name: name, Size: session.TotalSize, Path: target, State: InputReading})
	if role == RolePatch {
		composition.Plan, composition.Match = nil, nil
	}
	if err := s.repo.SetEntries(ctx, composition.ID, role, nil); err != nil {
		return err
	}
	s.touch(composition)
	s.tx.AfterCommit(ctx, func(ctx context.Context) {
		_ = s.queue.Enqueue(ctx, Read{CompositionID: composition.ID, Role: role})
	})
	return nil
}

func inputName(name string) string {
	base := filepath.Base(strings.ReplaceAll(strings.TrimSpace(name), `\`, "/"))
	if base == "." || base == "/" {
		return ""
	}
	return download.SafeSegment(base)
}

func (s *Service) Detach(ctx context.Context, who actor.Actor, id int, role Role) (View, error) {
	var detached Composition
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		composition, err := s.draft(ctx, who, id)
		if err != nil {
			return err
		}
		if previous := composition.input(role); previous != nil {
			if err := s.stage.Remove(ctx, previous.Path); err != nil {
				return err
			}
		}
		composition.setInput(role, nil)
		if role == RolePatch {
			composition.Plan, composition.Match = nil, nil
		}
		if err := s.repo.SetEntries(ctx, composition.ID, role, nil); err != nil {
			return err
		}
		s.touch(&composition)
		detached = composition
		return s.repo.Save(ctx, composition)
	})
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, detached)
}

func (s *Service) Edit(ctx context.Context, who actor.Actor, id int, changes Changes) (View, error) {
	var edited Composition
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		composition, err := s.draft(ctx, who, id)
		if err != nil {
			return err
		}
		replaced := changes.apply(&composition)
		if replaced {
			if err := s.draw(ctx, who, &composition); err != nil {
				return err
			}
		}
		s.touch(&composition)
		edited = composition
		return s.repo.Save(ctx, composition)
	})
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, edited)
}

func (s *Service) draft(ctx context.Context, who actor.Actor, id int) (Composition, error) {
	composition, err := s.locked(ctx, who, id)
	if err != nil {
		return Composition{}, err
	}
	if composition.State != StateDraft || composition.Rebuild() {
		return Composition{}, ErrNotDraft
	}
	return composition, nil
}

func (s *Service) Start(ctx context.Context, who actor.Actor, id int) (View, error) {
	var started Composition
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		composition, err := s.draft(ctx, who, id)
		if err != nil {
			return err
		}
		if err := s.launch(ctx, who, &composition); err != nil {
			return err
		}
		started = composition
		return s.repo.Save(ctx, composition)
	})
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, started)
}

func (s *Service) launch(ctx context.Context, who actor.Actor, composition *Composition) error {
	if !composition.Patch.Ready() || composition.Plan == nil || (composition.Save != nil && !composition.Save.Ready()) {
		return ErrNotReady
	}
	if len(composition.Plan.Conflicts) > 0 {
		return ErrPathConflict.WithArgs(map[string]any{"path": composition.Plan.Conflicts[0]})
	}
	if composition.Plan.Empty() {
		return ErrNothingToApply
	}
	queued, err := s.repo.CountQueued(ctx)
	if err != nil {
		return err
	}
	if queued >= QueueLimit.Read(s.settings) {
		return ErrQueueFull
	}
	allowance, err := s.quota.Allowance(ctx, composition.CreatorID)
	if err != nil {
		return err
	}
	if err := allowance.Admit(composition.Estimate()); err != nil {
		return err
	}
	base, _, err := s.usable(ctx, composition.Base.ResourceID)
	if err != nil {
		return err
	}
	if composition.ResourceID == nil {
		resource, err := s.resources.Begin(ctx, who, composition.resource(base))
		if err != nil {
			return err
		}
		composition.ResourceID = &resource.ID
	}
	if composition.OutputName, err = s.fileName(ctx, *composition); err != nil {
		return err
	}
	composition.Queue(s.touch(composition))
	job := Run{CompositionID: composition.ID}
	s.tx.AfterCommit(ctx, func(ctx context.Context) { _ = s.queue.Enqueue(ctx, job) })
	return nil
}

func (c Composition) resource(base download.GameResource) download.ComposedDraft {
	portable := download.FormPortable
	return download.ComposedDraft{
		GameID:    c.GameID,
		Platforms: slices.Clone(base.Platforms),
		Languages: slices.Clone(c.Details.Languages),
		Simulator: base.Simulator,
		Info: download.InfoInput{
			Translation:  c.Details.Translation,
			Translators:  slices.Clone(c.Details.Translators),
			PatchVersion: c.Details.PatchVersion,
			ReleaseURL:   c.Details.ReleaseURL,
			Form:         &portable,
			Extras:       c.Extras(),
		},
	}
}

func (s *Service) Retry(ctx context.Context, who actor.Actor, id int) (View, error) {
	var retried Composition
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		composition, err := s.locked(ctx, who, id)
		if err != nil {
			return err
		}
		if composition.State != StateFailed || !composition.Patch.Ready() || composition.Plan == nil {
			return ErrNotFailed
		}
		composition.Queue(s.touch(&composition))
		retried = composition
		job := Run{CompositionID: composition.ID}
		s.tx.AfterCommit(ctx, func(ctx context.Context) { _ = s.queue.Enqueue(ctx, job) })
		return s.repo.Save(ctx, composition)
	})
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, retried)
}

func (s *Service) Discard(ctx context.Context, who actor.Actor, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		composition, err := s.locked(ctx, who, id)
		if err != nil {
			return err
		}
		if composition.State != StateDraft && composition.State != StateFailed {
			return ErrBusy
		}
		return s.drop(ctx, composition)
	})
}

func (s *Service) drop(ctx context.Context, composition Composition) error {
	if err := s.repo.Delete(ctx, composition.ID); err != nil {
		return err
	}
	if composition.ResourceID != nil && !composition.Rebuild() {
		if err := s.resources.Discard(ctx, *composition.ResourceID); err != nil {
			return err
		}
	}
	dir, err := s.stage.Open(ctx, composition.ID)
	if err != nil {
		return err
	}
	return s.stage.Discard(ctx, dir)
}

func (s *Service) Rebuild(ctx context.Context, who actor.Actor, resourceID int, in RebuildInput) (View, error) {
	if !s.examiner.Checking() {
		return View{}, ErrChecksOff
	}
	resource, err := s.resources.Owned(ctx, who, resourceID)
	if err != nil {
		return View{}, err
	}
	var rebuilt Composition
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		past, err := s.repo.OfResource(ctx, resourceID)
		if err != nil {
			return err
		}
		latest := slices.IndexFunc(past, func(one Composition) bool { return one.State == StateDone })
		target := resource.MainFiles()
		if latest < 0 || len(target) != 1 || !resource.Published() {
			return ErrNotComposed
		}
		if past[0].State != StateDone {
			return ErrBusy
		}
		_, base, err := s.usable(ctx, past[latest].Base.ResourceID)
		if err != nil {
			return err
		}
		created, err := s.repo.Create(ctx, past[latest].next(who, base, target[0].ID, in))
		if err != nil {
			return err
		}
		if err := s.inherit(ctx, &created, past[latest]); err != nil {
			return err
		}
		if err := s.receive(ctx, who, &created, RolePatch, in.Upload); err != nil {
			return err
		}
		rebuilt = created
		return s.repo.Save(ctx, created)
	})
	if err != nil {
		return View{}, err
	}
	return s.view(ctx, who, rebuilt)
}

func (c Composition) next(who actor.Actor, base Base, fileID int, in RebuildInput) NewComposition {
	details := c.Details
	details.PatchVersion = in.PatchVersion
	placement := Placement{}
	if c.Plan != nil {
		placement.GameDir = &c.Plan.GameDir
	}
	return NewComposition{
		GameID:       c.GameID,
		CreatorID:    who.UserID,
		ResourceID:   c.ResourceID,
		TargetFileID: &fileID,
		Base:         base,
		Details:      details,
		Placement:    placement,
		KeepPatch:    c.KeepPatch,
		Note:         in.Note,
	}
}

func (s *Service) inherit(ctx context.Context, composition *Composition, from Composition) error {
	if !from.Save.Ready() {
		return nil
	}
	dir, err := s.stage.Open(ctx, composition.ID)
	if err != nil {
		return err
	}
	kept := *from.Save
	kept.Path = filepath.Join(dir, inputsDir, string(RoleSave), kept.Name)
	if err := s.stage.Link(ctx, from.Save.Path, kept.Path); err != nil {
		return err
	}
	entries, err := s.repo.Entries(ctx, from.ID, RoleSave)
	if err != nil {
		return err
	}
	composition.Save = &kept
	return s.repo.SetEntries(ctx, composition.ID, RoleSave, entries)
}
