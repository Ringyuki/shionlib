package compositionhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type compositionBaseDTO struct {
	ResourceID  int                     `json:"resource_id"`
	Name        string                  `json:"name" doc:"The name of the file that would be unpacked, the first volume of a set"`
	Size        int64                   `json:"size"`
	Language    []string                `json:"language" enum:"en,zh,zh-hant,jp"`
	Edition     *download.Edition       `json:"edition" enum:"download,package,steam"`
	EditionName *string                 `json:"edition_name"`
	Form        *download.Form          `json:"form" enum:"disc,installer,portable"`
	Creator     userhttp.UserSummaryDTO `json:"creator"`
	Downloads   int                     `json:"downloads"`
	Reason      *composition.Unusable   `json:"reason" enum:"disc,installer,form_unknown,unread,unreadable,too_large,pending,composed" doc:"Why the resource cannot be composed on; null when it can"`
}

type compositionInputDTO struct {
	Name     string                 `json:"name"`
	Size     int64                  `json:"size"`
	State    composition.InputState `json:"state" enum:"reading,ready,refused"`
	Refusal  *composition.Refusal   `json:"refusal" enum:"encrypted,broken,not_archive,harmful,too_many_files"`
	Viruses  []string               `json:"viruses"`
	Files    int                    `json:"files"`
	Unpacked int64                  `json:"unpacked"`
}

type compositionDetailsDTO struct {
	Language     []string              `json:"language" enum:"en,zh,zh-hant,jp"`
	Translation  *download.Translation `json:"translation" enum:"none,official,group,machine"`
	Translators  []string              `json:"translators"`
	PatchVersion *string               `json:"patch_version"`
	ReleaseURL   *string               `json:"release_url"`
}

type compositionMatchDTO struct {
	Translators []string `json:"translators"`
	Version     *string  `json:"version"`
	URL         string   `json:"url" doc:"The page of the same file on 鲲 Galgame 补丁"`
}

type compositionDirDTO struct {
	Path  string `json:"path" doc:"Empty for the root of the archive"`
	Items int    `json:"items"`
}

type compositionChangeDTO struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	OldSize *int64 `json:"old_size" doc:"The size of the file that is replaced; null for a file that is added"`
}

type compositionCountDTO struct {
	Files int   `json:"files"`
	Size  int64 `json:"size"`
}

type compositionPlanDTO struct {
	GameDir   string                 `json:"game_dir"`
	PatchDir  string                 `json:"patch_dir"`
	GameDirs  []compositionDirDTO    `json:"game_dirs"`
	PatchDirs []compositionDirDTO    `json:"patch_dirs"`
	Added     []compositionChangeDTO `json:"added" doc:"The first files that are added; adds counts all of them"`
	Replaced  []compositionChangeDTO `json:"replaced" doc:"The first files that are replaced; replaces counts all of them"`
	Conflicts []string               `json:"conflicts" doc:"Patch files that would take the place of a folder, or lie below a file; a composition with any cannot start"`
	Adds      compositionCountDTO    `json:"adds"`
	Replaces  compositionCountDTO    `json:"replaces"`
	Unchanged compositionCountDTO    `json:"unchanged"`
	Total     compositionCountDTO    `json:"total"`
}

type compositionFolderDTO struct {
	Role  string `json:"role" enum:"game,save,patch"`
	Name  string `json:"name"`
	Items int    `json:"items"`
	Size  int64  `json:"size"`
}

type compositionStepDTO struct {
	Step    composition.Step `json:"step" enum:"fetch,unpack,apply,pack,check,store"`
	State   string           `json:"state" enum:"waiting,running,done"`
	Seconds *int             `json:"seconds" doc:"How long the step took, or has been running; null for a step not reached"`
}

type compositionSourceDTO struct {
	ResourceID int    `json:"resource_id"`
	Name       string `json:"name"`
	Size       int64  `json:"size"`
}

type compositionPartDTO struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type compositionDTO struct {
	ID            int                    `json:"id"`
	GameID        int                    `json:"game_id"`
	ResourceID    *int                   `json:"resource_id" doc:"The composed resource; null until the composition is started"`
	Rebuild       bool                   `json:"rebuild" doc:"Whether this composition replaces the file of a resource composed before"`
	State         composition.State      `json:"state" enum:"draft,queued,running,done,failed"`
	Base          compositionSourceDTO   `json:"base"`
	Patch         *compositionInputDTO   `json:"patch"`
	Save          *compositionInputDTO   `json:"save"`
	Details       compositionDetailsDTO  `json:"details"`
	KeepPatch     bool                   `json:"keep_patch"`
	Note          *string                `json:"note"`
	Match         *compositionMatchDTO   `json:"match"`
	Plan          *compositionPlanDTO    `json:"plan" doc:"What the patch adds and replaces; null until the base and the patch are read"`
	Folders       []compositionFolderDTO `json:"folders" doc:"The folders at the root of the result"`
	FileName      string                 `json:"file_name" doc:"The name the result takes; empty until the languages are chosen"`
	EstimatedSize int64                  `json:"estimated_size"`
	Size          *int64                 `json:"size" doc:"The size of the result once packed"`
	Ahead         int                    `json:"ahead" doc:"How many compositions run or wait before this one"`
	Step          *composition.Step      `json:"step" enum:"fetch,unpack,apply,pack,check,store"`
	Percent       int                    `json:"percent" doc:"Progress of the running step where it is known"`
	Steps         []compositionStepDTO   `json:"steps"`
	Failure       *composition.Failure   `json:"failure" enum:"base_gone,base_unreadable,patch_unreadable,save_unreadable,place_missing,no_room,too_large,harmful,broken,nothing_to_apply,path_conflict,queue_full,quota,internal"`
	FailureDetail *string                `json:"failure_detail"`
	QueuedAt      *time.Time             `json:"queued_at"`
	StartedAt     *time.Time             `json:"started_at"`
	FinishedAt    *time.Time             `json:"finished_at"`
	Updated       time.Time              `json:"updated"`
}

type compositionOriginDTO struct {
	ID           int                  `json:"id"`
	Base         compositionSourceDTO `json:"base"`
	BaseGone     bool                 `json:"base_gone" doc:"Whether the base has been removed since; the resource then cannot be composed again"`
	Patch        *compositionPartDTO  `json:"patch"`
	Save         *compositionPartDTO  `json:"save"`
	PatchVersion *string              `json:"patch_version"`
	KeepPatch    bool                 `json:"keep_patch"`
	FinishedAt   *time.Time           `json:"finished_at"`
}

type compositionLineageDTO struct {
	Current *compositionDTO       `json:"current" doc:"The composition under way or failed, for its owner; null otherwise"`
	Latest  *compositionOriginDTO `json:"latest" doc:"What the resource was last composed from; null for a resource that was uploaded"`
}

func toBaseDTO(candidate composition.Candidate, now time.Time) compositionBaseDTO {
	resource := candidate.Resource
	return compositionBaseDTO{
		ResourceID:  resource.ID,
		Name:        candidate.Base.Name,
		Size:        candidate.Base.Size,
		Language:    listed(resource.Languages),
		Edition:     resource.Info.Edition,
		EditionName: resource.Info.EditionName,
		Form:        resource.Info.Form,
		Creator:     userhttp.ToUserSummary(resource.Creator, now),
		Downloads:   resource.Downloads,
		Reason:      candidate.Reason,
	}
}

func listed(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func toInputDTO(input *composition.Input) *compositionInputDTO {
	if input == nil {
		return nil
	}
	return &compositionInputDTO{Name: input.Name, Size: input.Size, State: input.State, Refusal: input.Refusal, Viruses: listed(input.Viruses), Files: input.Files, Unpacked: input.Unpacked}
}

func toPartDTO(input *composition.Input) *compositionPartDTO {
	if input == nil {
		return nil
	}
	return &compositionPartDTO{Name: input.Name, Size: input.Size}
}

func toDirDTOs(dirs []composition.Dir) []compositionDirDTO {
	out := make([]compositionDirDTO, len(dirs))
	for i, dir := range dirs {
		out[i] = compositionDirDTO(dir)
	}
	return out
}

func toChangeDTOs(changes []composition.Change) []compositionChangeDTO {
	out := make([]compositionChangeDTO, len(changes))
	for i, change := range changes {
		out[i] = compositionChangeDTO(change)
	}
	return out
}

func toPlanDTO(plan *composition.Plan) *compositionPlanDTO {
	if plan == nil {
		return nil
	}
	return &compositionPlanDTO{
		GameDir: plan.GameDir, PatchDir: plan.PatchDir, GameDirs: toDirDTOs(plan.GameDirs), PatchDirs: toDirDTOs(plan.PatchDirs),
		Added: toChangeDTOs(plan.Added), Replaced: toChangeDTOs(plan.Replaced), Conflicts: listed(plan.Conflicts),
		Adds: compositionCountDTO(plan.Adds), Replaces: compositionCountDTO(plan.Replaces), Unchanged: compositionCountDTO(plan.Unchanged), Total: compositionCountDTO(plan.Total),
	}
}

func toStepDTOs(steps []composition.Progress) []compositionStepDTO {
	out := make([]compositionStepDTO, len(steps))
	for i, step := range steps {
		state := "waiting"
		switch {
		case step.Done:
			state = "done"
		case step.Running:
			state = "running"
		}
		out[i] = compositionStepDTO{Step: step.Step, State: state, Seconds: step.Seconds}
	}
	return out
}

func toCompositionDTO(view composition.View) compositionDTO {
	folders := make([]compositionFolderDTO, len(view.Folders))
	for i, folder := range view.Folders {
		folders[i] = compositionFolderDTO(folder)
	}
	dto := compositionDTO{
		ID:         view.ID,
		GameID:     view.GameID,
		ResourceID: view.ResourceID,
		Rebuild:    view.Rebuild(),
		State:      view.State,
		Base:       compositionSourceDTO{ResourceID: view.Base.ResourceID, Name: view.Base.Name, Size: view.Base.Size},
		Patch:      toInputDTO(view.Patch),
		Save:       toInputDTO(view.Save),
		Details: compositionDetailsDTO{
			Language: listed(view.Details.Languages), Translation: view.Details.Translation, Translators: listed(view.Details.Translators),
			PatchVersion: view.Details.PatchVersion, ReleaseURL: view.Details.ReleaseURL,
		},
		KeepPatch:     view.KeepPatch,
		Note:          view.Note,
		Plan:          toPlanDTO(view.Plan),
		Folders:       folders,
		FileName:      view.FileName,
		EstimatedSize: view.Estimate(),
		Size:          view.OutputSize,
		Ahead:         view.Ahead,
		Step:          view.Step,
		Percent:       view.Percent,
		Steps:         toStepDTOs(view.Steps),
		Failure:       view.Failure,
		FailureDetail: view.FailureDetail,
		QueuedAt:      view.QueuedAt,
		StartedAt:     view.StartedAt,
		FinishedAt:    view.FinishedAt,
		Updated:       view.Updated,
	}
	if view.Match != nil {
		dto.Match = &compositionMatchDTO{Translators: listed(view.Match.Translators), Version: view.Match.Version, URL: view.Match.URL}
	}
	return dto
}

func toLineageDTO(lineage composition.Lineage) compositionLineageDTO {
	var dto compositionLineageDTO
	if lineage.Current != nil {
		current := toCompositionDTO(*lineage.Current)
		dto.Current = &current
	}
	if latest := lineage.Latest; latest != nil {
		dto.Latest = &compositionOriginDTO{
			ID:           latest.ID,
			Base:         compositionSourceDTO{ResourceID: latest.Base.ResourceID, Name: latest.Base.Name, Size: latest.Base.Size},
			BaseGone:     lineage.BaseGone,
			Patch:        toPartDTO(latest.Patch),
			Save:         toPartDTO(latest.Save),
			PatchVersion: latest.Details.PatchVersion,
			KeepPatch:    latest.KeepPatch,
			FinishedAt:   latest.FinishedAt,
		}
	}
	return dto
}
