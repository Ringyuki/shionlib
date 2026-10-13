package composition

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type RunService struct {
	repo      Repository
	bases     Bases
	spool     Spool
	examiner  Examiner
	resources Resources
	objects   Objects
	archiver  Archiver
	stage     Stage
	notices   *NoticeService
	tx        Transactor
	settings  setting.Source
	now       func() time.Time
}

func NewRunService(deps Deps, notices *NoticeService) *RunService {
	return &RunService{
		repo:      deps.Repo,
		bases:     deps.Bases,
		spool:     deps.Spool,
		examiner:  deps.Examiner,
		resources: deps.Resources,
		objects:   deps.Objects,
		archiver:  deps.Archiver,
		stage:     deps.Stage,
		notices:   notices,
		tx:        deps.Tx,
		settings:  deps.Settings,
		now:       deps.Now,
	}
}

func (r *RunService) Run(ctx context.Context, id int) error {
	composition, claimed, err := r.claim(ctx, id)
	if err != nil || !claimed {
		return err
	}
	dir, err := r.stage.Open(ctx, composition.ID)
	if err != nil {
		return err
	}
	work := filepath.Join(dir, workDir)
	err = r.compose(ctx, &composition, work)
	var halted stopped
	switch {
	case err == nil:
		return r.succeed(ctx, composition, dir)
	case errors.As(err, &halted):
		return r.fail(ctx, composition, work, halted)
	}
	return err
}

func (r *RunService) GiveUp(ctx context.Context, id int, cause error) error {
	composition, err := r.repo.Get(ctx, id)
	if errors.Is(err, ErrNotFound) || (err == nil && composition.State != StateRunning) {
		return nil
	}
	if err != nil {
		return err
	}
	dir, err := r.stage.Open(ctx, composition.ID)
	if err != nil {
		return err
	}
	return r.fail(ctx, composition, filepath.Join(dir, workDir), stopped{reason: FailureInternal, detail: cause.Error()})
}

func (r *RunService) claim(ctx context.Context, id int) (Composition, bool, error) {
	var claimed Composition
	started := false
	err := r.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := r.repo.LockQueue(ctx); err != nil {
			return err
		}
		composition, err := r.repo.Lock(ctx, id)
		if errors.Is(err, ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		switch composition.State {
		case StateRunning:
		case StateQueued:
			running, err := r.repo.CountRunning(ctx)
			if err != nil {
				return err
			}
			if running >= Concurrency.Read(r.settings) {
				return ErrNoSlot
			}
		default:
			return nil
		}
		now := r.now()
		composition.State = StateRunning
		composition.StartedAt = &now
		composition.Runs = nil
		composition.Step = nil
		composition.Percent = 0
		composition.Updated = now
		claimed, started = composition, true
		return r.repo.Save(ctx, composition)
	})
	return claimed, started, err
}

func (r *RunService) begin(ctx context.Context, composition *Composition, step Step) error {
	composition.Begin(step, r.now())
	composition.Updated = r.now()
	return r.repo.Save(ctx, *composition)
}

func (r *RunService) observer(ctx context.Context, composition *Composition) func(percent int) {
	last := r.now()
	return func(percent int) {
		percent = min(max(percent, 0), 100)
		if now := r.now(); percent != composition.Percent && now.Sub(last) >= progressEvery {
			last = now
			composition.Percent = percent
			_ = r.repo.SetProgress(ctx, composition.ID, percent)
		}
	}
}

func (r *RunService) compose(ctx context.Context, composition *Composition, work string) error {
	if composition.Plan == nil || !composition.Patch.Ready() || composition.ResourceID == nil {
		return stop(FailureInternal, "the composition has no plan")
	}
	if err := r.stage.Clear(ctx, work); err != nil {
		return err
	}
	archive, err := r.fetch(ctx, composition, work)
	if err != nil {
		return err
	}
	tree := filepath.Join(work, treeDir)
	if err := r.unpack(ctx, composition, archive, work, tree); err != nil {
		return err
	}
	out := filepath.Join(work, outputDir)
	folders, err := r.apply(ctx, composition, tree, out)
	if err != nil {
		return err
	}
	if err := r.stage.Remove(ctx, tree); err != nil {
		return err
	}
	target := filepath.Join(work, composition.OutputName)
	if err := r.pack(ctx, composition, out, folders, target); err != nil {
		return err
	}
	return r.deliver(ctx, composition, target)
}

func (r *RunService) fetch(ctx context.Context, composition *Composition, work string) (string, error) {
	if err := r.begin(ctx, composition, StepFetch); err != nil {
		return "", err
	}
	resource, err := r.bases.Stored(ctx, composition.Base.ResourceID)
	if errors.Is(err, download.ErrResourceNotFound) {
		return "", stop(FailureBaseGone, "")
	}
	if err != nil {
		return "", err
	}
	files := resource.MainFiles()
	if len(files) == 0 || len(files) != len(composition.Base.FileIDs) {
		return "", stop(FailureBaseGone, "")
	}
	names := make([]string, len(files))
	for i, file := range files {
		if file.ID != composition.Base.FileIDs[i] || file.Status != download.FileInObjectStore || file.StorageKey == nil {
			return "", stop(FailureBaseGone, "")
		}
		names[i] = file.Name
	}
	room, err := r.spool.SpoolRoom(ctx)
	if err != nil {
		return "", err
	}
	if room < composition.Needed() {
		return "", stop(FailureNoRoom, "")
	}
	observe := r.observer(ctx, composition)
	var fetched int64
	for _, file := range files {
		target := filepath.Join(work, fetchedDir, file.Name)
		err := r.objects.Download(ctx, *file.StorageKey, target, func(done int64) {
			observe(int((fetched + done) * 100 / max(composition.Base.Size, 1)))
		})
		if errors.Is(err, scan.ErrObjectMissing) {
			return "", stop(FailureBaseGone, "")
		}
		if err != nil {
			return "", err
		}
		fetched += file.Size
	}
	return filepath.Join(work, fetchedDir, entryVolume(names)), nil
}

func entryVolume(names []string) string {
	sets := download.VolumeSets(names)
	if len(sets) > 0 && sets[0].Scheme == download.SchemeZipSplit {
		return names[len(names)-1]
	}
	return names[0]
}

func (r *RunService) unpack(ctx context.Context, composition *Composition, archive, work, tree string) error {
	if err := r.begin(ctx, composition, StepUnpack); err != nil {
		return err
	}
	threads := PackThreads.Read(r.settings)
	base := filepath.Join(tree, string(FolderGame))
	err := r.archiver.Unpack(ctx, Unpacking{Archive: archive, Destination: base, Threads: threads}, r.observer(ctx, composition))
	if errors.Is(err, ErrUnreadable) {
		return stop(FailureBaseUnreadable, err.Error())
	}
	if err != nil {
		return err
	}
	if err := r.stage.Sweep(ctx, base, composition.Base.Encoding); err != nil {
		return err
	}
	size, err := r.stage.Size(ctx, base)
	if err != nil {
		return err
	}
	if size > MaxUnpackedSize.Read(r.settings)+sizeTolerance {
		return stop(FailureTooLarge, "")
	}
	if err := r.stage.Remove(ctx, filepath.Join(work, fetchedDir)); err != nil {
		return err
	}
	patch := filepath.Join(tree, string(FolderPatch))
	err = r.archiver.Unpack(ctx, Unpacking{Archive: composition.Patch.Path, Destination: patch, Threads: threads}, func(int) {})
	if errors.Is(err, ErrUnreadable) {
		return stop(FailurePatchUnreadable, err.Error())
	}
	if err != nil {
		return err
	}
	return r.stage.Sweep(ctx, patch, composition.Patch.Encoding)
}

func (r *RunService) apply(ctx context.Context, composition *Composition, tree, out string) ([]string, error) {
	if err := r.begin(ctx, composition, StepApply); err != nil {
		return nil, err
	}
	base, patch := filepath.Join(tree, string(FolderGame)), filepath.Join(tree, string(FolderPatch))
	gameNodes, err := r.stage.Tree(ctx, base)
	if err != nil {
		return nil, err
	}
	patchNodes, err := r.stage.Tree(ctx, patch)
	if err != nil {
		return nil, err
	}
	gameDir, found := Resolve(gameNodes, composition.Plan.GameDir)
	if !found {
		return nil, stop(FailurePlaceMissing, composition.Plan.GameDir)
	}
	patchDir, found := Resolve(patchNodes, composition.Plan.PatchDir)
	if !found {
		return nil, stop(FailurePlaceMissing, composition.Plan.PatchDir)
	}
	moves, conflicts := Overlay(Under(gameNodes, gameDir), Under(patchNodes, patchDir))
	if len(conflicts) > 0 {
		return nil, stop(FailureConflict, conflicts[0])
	}
	if len(moves) == 0 {
		return nil, stop(FailureNothing, "")
	}
	for _, move := range moves {
		source := filepath.Join(patch, filepath.FromSlash(patchDir), filepath.FromSlash(move.From))
		target := filepath.Join(base, filepath.FromSlash(gameDir), filepath.FromSlash(move.To))
		if err := r.stage.Move(ctx, source, target); err != nil {
			return nil, err
		}
	}
	return r.assemble(ctx, composition, base, out, gameNodes)
}

func (r *RunService) assemble(ctx context.Context, composition *Composition, base, out string, gameNodes []Node) ([]string, error) {
	folder := composition.Plan.Folder
	source := base
	if tops := Tops(gameNodes); len(tops) == 1 && tops[0].Dir {
		folder = tops[0].Path
		source = filepath.Join(base, folder)
	}
	if folder == "" {
		folder = untitledFolder
	}
	if err := r.stage.Move(ctx, source, filepath.Join(out, folder)); err != nil {
		return nil, err
	}
	folders := []string{folder}
	if composition.Save.Ready() {
		target := filepath.Join(out, SaveFolder)
		err := r.archiver.Unpack(ctx, Unpacking{Archive: composition.Save.Path, Destination: target, Threads: PackThreads.Read(r.settings)}, func(int) {})
		if errors.Is(err, ErrUnreadable) {
			return nil, stop(FailureSaveUnreadable, err.Error())
		}
		if err != nil {
			return nil, err
		}
		if err := r.stage.Sweep(ctx, target, composition.Save.Encoding); err != nil {
			return nil, err
		}
		folders = append(folders, SaveFolder)
	}
	if composition.KeepPatch {
		if err := r.stage.Link(ctx, composition.Patch.Path, filepath.Join(out, PatchFolder, composition.Patch.Name)); err != nil {
			return nil, err
		}
		folders = append(folders, PatchFolder)
	}
	return folders, nil
}

func (r *RunService) pack(ctx context.Context, composition *Composition, out string, folders []string, target string) error {
	if err := r.begin(ctx, composition, StepPack); err != nil {
		return err
	}
	packing := Packing{Root: out, Entries: folders, Target: target, Threads: PackThreads.Read(r.settings)}
	if err := r.archiver.Pack(ctx, packing, r.observer(ctx, composition)); err != nil {
		return err
	}
	return r.stage.Remove(ctx, out)
}

func (r *RunService) deliver(ctx context.Context, composition *Composition, target string) error {
	if err := r.begin(ctx, composition, StepCheck); err != nil {
		return err
	}
	size, err := r.stage.Size(ctx, target)
	if err != nil {
		return err
	}
	finding, err := r.examiner.Examine(ctx, scan.LocalFile{ResourceID: *composition.ResourceID, Name: composition.OutputName, Path: target, Size: size}, true)
	if errors.Is(err, scan.ErrChecksDisabled) {
		return stop(FailureInternal, err.Error())
	}
	if err != nil {
		return err
	}
	if finding.Status != download.CheckOK {
		return stop(FailureBroken, "")
	}
	if finding.Infected() {
		return stop(FailureHarmful, harm(finding))
	}
	if err := r.begin(ctx, composition, StepStore); err != nil {
		return err
	}
	composition.OutputSize = &size
	if composition.Rebuild() {
		return r.resources.Replace(ctx, download.ComposedReplacement{
			FileID:       *composition.TargetFileID,
			OperatorID:   composition.CreatorID,
			Name:         composition.OutputName,
			LocalPath:    target,
			Size:         size,
			SHA256:       finding.SHA256,
			InspectionID: finding.InspectionID,
			PatchVersion: composition.Details.PatchVersion,
			Extras:       composition.Extras(),
			Reason:       composition.Note,
		})
	}
	return r.resources.Publish(ctx, download.ComposedFile{
		ResourceID:   *composition.ResourceID,
		Name:         composition.OutputName,
		LocalPath:    target,
		Size:         size,
		SHA256:       finding.SHA256,
		InspectionID: finding.InspectionID,
		Changes:      composition.origin(),
	})
}

func harm(finding scan.LocalFinding) string {
	if len(finding.Detections) > 0 {
		return fmt.Sprintf("%s (%s)", finding.Detections[0].Signature, finding.Detections[0].Path)
	}
	if len(finding.Viruses) > 0 {
		return finding.Viruses[0]
	}
	return ""
}

func (c Composition) origin() []download.FieldChange {
	changes := []download.FieldChange{{Field: download.FieldBase, Old: []string{}, New: []string{c.Base.Name}}}
	if c.Details.PatchVersion != nil && *c.Details.PatchVersion != "" {
		changes = append(changes, download.FieldChange{Field: download.FieldPatchVersion, Old: []string{}, New: []string{*c.Details.PatchVersion}})
	}
	if extras := c.Extras(); len(extras) > 0 {
		changes = append(changes, download.FieldChange{Field: download.FieldExtras, Old: []string{}, New: extras})
	}
	return changes
}

func (r *RunService) succeed(ctx context.Context, composition Composition, dir string) error {
	composition.Succeed(r.now())
	composition.Updated = r.now()
	if err := r.repo.Save(ctx, composition); err != nil {
		return err
	}
	if err := r.tidy(ctx, composition, dir); err != nil {
		return err
	}
	return r.notices.Done(ctx, composition)
}

func (r *RunService) tidy(ctx context.Context, composition Composition, dir string) error {
	if !composition.Save.Ready() {
		return r.stage.Discard(ctx, dir)
	}
	if err := r.stage.Remove(ctx, filepath.Join(dir, workDir)); err != nil {
		return err
	}
	return r.stage.Remove(ctx, filepath.Join(dir, inputsDir, string(RolePatch)))
}

func (r *RunService) fail(ctx context.Context, composition Composition, work string, halted stopped) error {
	composition.Fail(halted.reason, halted.detail, r.now())
	composition.Updated = r.now()
	if err := r.repo.Save(ctx, composition); err != nil {
		return err
	}
	if err := r.stage.Remove(ctx, work); err != nil {
		return err
	}
	return r.notices.Failed(ctx, composition)
}
