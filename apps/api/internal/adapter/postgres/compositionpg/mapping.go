package compositionpg

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type baseRecord struct {
	ResourceID   int    `json:"resource_id"`
	FileIDs      []int  `json:"file_ids"`
	Name         string `json:"name"`
	Size         int64  `json:"size"`
	InspectionID int    `json:"inspection_id"`
	Unpacked     int64  `json:"unpacked"`
	Encoding     string `json:"encoding"`
}

type inputRecord struct {
	Name     string   `json:"name"`
	Size     int64    `json:"size"`
	Path     string   `json:"path"`
	SHA256   string   `json:"sha256"`
	State    string   `json:"state"`
	Refusal  *string  `json:"refusal"`
	Viruses  []string `json:"viruses"`
	Encoding string   `json:"encoding"`
	Files    int      `json:"files"`
	Unpacked int64    `json:"unpacked"`
}

type detailsRecord struct {
	Languages    []string `json:"languages"`
	Translation  *string  `json:"translation"`
	Translators  []string `json:"translators"`
	PatchVersion *string  `json:"patch_version"`
	ReleaseURL   *string  `json:"release_url"`
}

type matchRecord struct {
	Translators []string `json:"translators"`
	Version     *string  `json:"version"`
	URL         string   `json:"url"`
}

type dirRecord struct {
	Path  string `json:"path"`
	Items int    `json:"items"`
}

type changeRecord struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	OldSize *int64 `json:"old_size"`
}

type countRecord struct {
	Files int   `json:"files"`
	Size  int64 `json:"size"`
}

type planRecord struct {
	Folder    string         `json:"folder"`
	GameDir   string         `json:"game_dir"`
	PatchDir  string         `json:"patch_dir"`
	GameDirs  []dirRecord    `json:"game_dirs"`
	PatchDirs []dirRecord    `json:"patch_dirs"`
	Added     []changeRecord `json:"added"`
	Replaced  []changeRecord `json:"replaced"`
	Conflicts []string       `json:"conflicts"`
	Adds      countRecord    `json:"adds"`
	Replaces  countRecord    `json:"replaces"`
	Unchanged countRecord    `json:"unchanged"`
	Total     countRecord    `json:"total"`
}

type runRecord struct {
	Step     string     `json:"step"`
	Started  time.Time  `json:"started"`
	Finished *time.Time `json:"finished"`
}

type entryRecord struct {
	Path string `json:"p"`
	Size int64  `json:"s"`
}

func encoded(value any) (json.RawMessage, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("encode a composition column: %w", err)
	}
	return raw, nil
}

func decoded[T any](raw json.RawMessage, column string) (*T, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var value T
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, fmt.Errorf("decode the %s of a composition: %w", column, err)
	}
	return &value, nil
}

func baseOf(base composition.Base) baseRecord {
	return baseRecord{ResourceID: base.ResourceID, FileIDs: base.FileIDs, Name: base.Name, Size: base.Size, InspectionID: base.InspectionID, Unpacked: base.Unpacked, Encoding: base.Encoding}
}

func inputOf(input *composition.Input) *inputRecord {
	if input == nil {
		return nil
	}
	return &inputRecord{
		Name: input.Name, Size: input.Size, Path: input.Path, SHA256: input.SHA256, State: string(input.State), Refusal: (*string)(input.Refusal),
		Viruses: input.Viruses, Encoding: input.Encoding, Files: input.Files, Unpacked: input.Unpacked,
	}
}

func (r *inputRecord) input() *composition.Input {
	if r == nil {
		return nil
	}
	return &composition.Input{
		Name: r.Name, Size: r.Size, Path: r.Path, SHA256: r.SHA256, State: composition.InputState(r.State), Refusal: (*composition.Refusal)(r.Refusal),
		Viruses: r.Viruses, Encoding: r.Encoding, Files: r.Files, Unpacked: r.Unpacked,
	}
}

func detailsOf(details composition.Details) detailsRecord {
	return detailsRecord{Languages: details.Languages, Translation: (*string)(details.Translation), Translators: details.Translators, PatchVersion: details.PatchVersion, ReleaseURL: details.ReleaseURL}
}

func dirsOf(dirs []composition.Dir) []dirRecord {
	out := make([]dirRecord, len(dirs))
	for i, dir := range dirs {
		out[i] = dirRecord(dir)
	}
	return out
}

func changesOf(changes []composition.Change) []changeRecord {
	out := make([]changeRecord, len(changes))
	for i, change := range changes {
		out[i] = changeRecord(change)
	}
	return out
}

func planOf(plan *composition.Plan) *planRecord {
	if plan == nil {
		return nil
	}
	return &planRecord{
		Folder: plan.Folder, GameDir: plan.GameDir, PatchDir: plan.PatchDir, GameDirs: dirsOf(plan.GameDirs), PatchDirs: dirsOf(plan.PatchDirs),
		Added: changesOf(plan.Added), Replaced: changesOf(plan.Replaced), Conflicts: plan.Conflicts,
		Adds: countRecord(plan.Adds), Replaces: countRecord(plan.Replaces), Unchanged: countRecord(plan.Unchanged), Total: countRecord(plan.Total),
	}
}

func (r *planRecord) plan() *composition.Plan {
	if r == nil {
		return nil
	}
	plan := composition.Plan{
		Folder: r.Folder, GameDir: r.GameDir, PatchDir: r.PatchDir, Conflicts: r.Conflicts,
		Adds: composition.Count(r.Adds), Replaces: composition.Count(r.Replaces), Unchanged: composition.Count(r.Unchanged), Total: composition.Count(r.Total),
	}
	for _, dir := range r.GameDirs {
		plan.GameDirs = append(plan.GameDirs, composition.Dir(dir))
	}
	for _, dir := range r.PatchDirs {
		plan.PatchDirs = append(plan.PatchDirs, composition.Dir(dir))
	}
	for _, change := range r.Added {
		plan.Added = append(plan.Added, composition.Change(change))
	}
	for _, change := range r.Replaced {
		plan.Replaced = append(plan.Replaced, composition.Change(change))
	}
	return &plan
}

func runsOf(runs []composition.StepRun) []runRecord {
	out := make([]runRecord, len(runs))
	for i, run := range runs {
		out[i] = runRecord{Step: string(run.Step), Started: run.Started, Finished: run.Finished}
	}
	return out
}

func entriesOf(entries []composition.Entry) []entryRecord {
	out := make([]entryRecord, len(entries))
	for i, entry := range entries {
		out[i] = entryRecord(entry)
	}
	return out
}

func toComposition(row *ent.Composition) (composition.Composition, error) {
	out := composition.Composition{
		ID:            row.ID,
		GameID:        row.GameID,
		CreatorID:     row.CreatorID,
		ResourceID:    row.ResourceID,
		TargetFileID:  row.TargetFileID,
		Placement:     composition.Placement{GameDir: row.GameDir, PatchDir: row.PatchDir},
		KeepPatch:     row.KeepPatch,
		Note:          row.Note,
		State:         composition.State(row.State),
		Step:          (*composition.Step)(row.Step),
		Percent:       row.Percent,
		Failure:       (*composition.Failure)(row.Failure),
		FailureDetail: row.FailureDetail,
		OutputName:    row.OutputName,
		OutputSize:    row.OutputSize,
		QueuedAt:      row.QueuedAt,
		StartedAt:     row.StartedAt,
		FinishedAt:    row.FinishedAt,
		Created:       row.Created,
		Updated:       row.Updated,
	}
	base, err := decoded[baseRecord](row.Base, "base")
	if err != nil {
		return composition.Composition{}, err
	}
	if base != nil {
		out.Base = composition.Base{ResourceID: base.ResourceID, FileIDs: base.FileIDs, Name: base.Name, Size: base.Size, InspectionID: base.InspectionID, Unpacked: base.Unpacked, Encoding: base.Encoding}
	}
	patch, err := decoded[inputRecord](row.Patch, "patch")
	if err != nil {
		return composition.Composition{}, err
	}
	out.Patch = patch.input()
	save, err := decoded[inputRecord](row.Save, "save")
	if err != nil {
		return composition.Composition{}, err
	}
	out.Save = save.input()
	details, err := decoded[detailsRecord](row.Details, "details")
	if err != nil {
		return composition.Composition{}, err
	}
	if details != nil {
		out.Details = composition.Details{Languages: details.Languages, Translation: (*download.Translation)(details.Translation), Translators: details.Translators, PatchVersion: details.PatchVersion, ReleaseURL: details.ReleaseURL}
	}
	match, err := decoded[matchRecord](row.PatchMatch, "match")
	if err != nil {
		return composition.Composition{}, err
	}
	if match != nil {
		out.Match = &composition.Match{Translators: match.Translators, Version: match.Version, URL: match.URL}
	}
	plan, err := decoded[planRecord](row.Plan, "plan")
	if err != nil {
		return composition.Composition{}, err
	}
	out.Plan = plan.plan()
	runs, err := decoded[[]runRecord](row.Runs, "runs")
	if err != nil {
		return composition.Composition{}, err
	}
	if runs != nil {
		for _, run := range *runs {
			out.Runs = append(out.Runs, composition.StepRun{Step: composition.Step(run.Step), Started: run.Started, Finished: run.Finished})
		}
	}
	return out, nil
}
