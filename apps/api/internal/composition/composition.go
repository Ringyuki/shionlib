package composition

import (
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

const (
	InputEntryLimit = 50_000
	SaveFolder      = "全CG存档"
	PatchFolder     = "汉化补丁"
	OutputSuffix    = ".7z"
	untitledFolder  = "Game"
	inputsDir       = "inputs"
	workDir         = "work"
	activeListLimit = 100
	staleDraftBatch = 50
	unsettledBatch  = 200
	resourcePath    = "/resource/%d"
	fetchedDir      = "base"
	treeDir         = "tree"
	outputDir       = "out"
	progressEvery   = 3 * time.Second
	sizeTolerance   = 1 << 20
	noticePrefix    = "Messages.System.File.Compose."
	noticeLinkText  = "Messages.System.File.Upload.ResourceLinkText"
	reasonPrefix    = "COMPOSE_"
)

type State string

const (
	StateDraft   State = "draft"
	StateQueued  State = "queued"
	StateRunning State = "running"
	StateDone    State = "done"
	StateFailed  State = "failed"
)

type Step string

const (
	StepFetch  Step = "fetch"
	StepUnpack Step = "unpack"
	StepApply  Step = "apply"
	StepPack   Step = "pack"
	StepCheck  Step = "check"
	StepStore  Step = "store"
)

var Steps = []Step{StepFetch, StepUnpack, StepApply, StepPack, StepCheck, StepStore}

type Failure string

const (
	FailureBaseGone        Failure = "base_gone"
	FailureBaseUnreadable  Failure = "base_unreadable"
	FailurePatchUnreadable Failure = "patch_unreadable"
	FailureSaveUnreadable  Failure = "save_unreadable"
	FailurePlaceMissing    Failure = "place_missing"
	FailureNoRoom          Failure = "no_room"
	FailureTooLarge        Failure = "too_large"
	FailureHarmful         Failure = "harmful"
	FailureBroken          Failure = "broken"
	FailureNothing         Failure = "nothing_to_apply"
	FailureConflict        Failure = "path_conflict"
	FailureQueueFull       Failure = "queue_full"
	FailureQuota           Failure = "quota"
	FailureInternal        Failure = "internal"
)

type stopped struct {
	reason Failure
	detail string
}

func (s stopped) Error() string {
	return "composition stopped: " + string(s.reason) + " " + s.detail
}

func stop(reason Failure, detail string) error {
	return stopped{reason: reason, detail: detail}
}

type Role string

const (
	RolePatch Role = "patch"
	RoleSave  Role = "save"
)

type InputState string

const (
	InputReading InputState = "reading"
	InputReady   InputState = "ready"
	InputRefused InputState = "refused"
)

type Refusal string

const (
	RefusalEncrypted   Refusal = "encrypted"
	RefusalBroken      Refusal = "broken"
	RefusalNotArchive  Refusal = "not_archive"
	RefusalHarmful     Refusal = "harmful"
	RefusalTooManyFile Refusal = "too_many_files"
)

type Unusable string

const (
	UnusableDisc       Unusable = "disc"
	UnusableInstaller  Unusable = "installer"
	UnusableUnknown    Unusable = "form_unknown"
	UnusableUnread     Unusable = "unread"
	UnusableUnreadable Unusable = "unreadable"
	UnusableTooLarge   Unusable = "too_large"
	UnusablePending    Unusable = "pending"
	UnusableComposed   Unusable = "composed"
)

type Input struct {
	Name     string
	Size     int64
	Path     string
	SHA256   string
	State    InputState
	Refusal  *Refusal
	Viruses  []string
	Encoding string
	Files    int
	Unpacked int64
}

func (i *Input) Ready() bool {
	return i != nil && i.State == InputReady
}

type Base struct {
	ResourceID   int
	FileIDs      []int
	Name         string
	Size         int64
	InspectionID int
	Unpacked     int64
	Encoding     string
}

type Candidate struct {
	Resource download.GameResource
	Base     Base
	Reason   *Unusable
}

type Details struct {
	Languages    []string
	Translation  *download.Translation
	Translators  []string
	PatchVersion *string
	ReleaseURL   *string
}

type Match struct {
	Translators []string
	Version     *string
	URL         string
}

type StepRun struct {
	Step     Step
	Started  time.Time
	Finished *time.Time
}

type Composition struct {
	ID            int
	GameID        int
	CreatorID     int
	ResourceID    *int
	TargetFileID  *int
	Base          Base
	Patch         *Input
	Save          *Input
	Placement     Placement
	KeepPatch     bool
	Details       Details
	Note          *string
	Match         *Match
	Plan          *Plan
	State         State
	Step          *Step
	Percent       int
	Runs          []StepRun
	Failure       *Failure
	FailureDetail *string
	OutputName    string
	OutputSize    *int64
	QueuedAt      *time.Time
	StartedAt     *time.Time
	FinishedAt    *time.Time
	Created       time.Time
	Updated       time.Time
}

func (c Composition) Rebuild() bool {
	return c.TargetFileID != nil
}

func (c Composition) Active() bool {
	return c.State == StateQueued || c.State == StateRunning
}

func (c Composition) Estimate() int64 {
	size := c.Base.Size
	if c.Patch != nil {
		size += c.Patch.Size
		if c.KeepPatch {
			size += c.Patch.Size
		}
	}
	if c.Save != nil {
		size += c.Save.Size
	}
	return size
}

func (c Composition) Needed() int64 {
	needed := c.Base.Size + c.Base.Unpacked + c.Estimate()
	if c.Patch != nil {
		needed += c.Patch.Unpacked
	}
	if c.Save != nil {
		needed += c.Save.Unpacked
	}
	return needed
}

func (c Composition) Extras() []string {
	extras := []string{}
	if c.Save != nil {
		extras = append(extras, download.ExtraSave)
	}
	return extras
}

func (c *Composition) Begin(step Step, at time.Time) {
	c.finish(at)
	c.Step = &step
	c.Percent = 0
	c.Runs = append(c.Runs, StepRun{Step: step, Started: at})
}

func (c *Composition) finish(at time.Time) {
	if last := len(c.Runs) - 1; last >= 0 && c.Runs[last].Finished == nil {
		c.Runs[last].Finished = &at
	}
}

func (c *Composition) Succeed(at time.Time) {
	c.finish(at)
	c.State = StateDone
	c.Step = nil
	c.Percent = 0
	c.Failure, c.FailureDetail = nil, nil
	c.FinishedAt = &at
}

func (c *Composition) Fail(reason Failure, detail string, at time.Time) {
	c.finish(at)
	c.State = StateFailed
	c.Failure = &reason
	c.FailureDetail = nil
	if detail != "" {
		c.FailureDetail = &detail
	}
	c.FinishedAt = &at
}

func (c *Composition) Queue(at time.Time) {
	c.State = StateQueued
	c.Step = nil
	c.Percent = 0
	c.Runs = nil
	c.Failure, c.FailureDetail = nil, nil
	c.QueuedAt = &at
	c.StartedAt, c.FinishedAt = nil, nil
}

type Folder struct {
	Role  string
	Name  string
	Items int
	Size  int64
}

const (
	FolderGame  = "game"
	FolderSave  = "save"
	FolderPatch = "patch"
)

func WrapperOf(base []Entry) (string, bool) {
	wrapper := ""
	for _, entry := range base {
		first, _, nested := cutFirst(entry.Path)
		if !nested || (wrapper != "" && Key(first) != Key(wrapper)) {
			return "", false
		}
		wrapper = first
	}
	return wrapper, wrapper != ""
}

func cutFirst(name string) (string, string, bool) {
	for i := range len(name) {
		if name[i] == '/' {
			return name[:i], name[i+1:], true
		}
	}
	return name, "", false
}

func (c Composition) Layout(gameFolder string) []Folder {
	if c.Plan == nil {
		return nil
	}
	folders := []Folder{{Role: FolderGame, Name: gameFolder, Items: c.Plan.Total.Files, Size: c.Plan.Total.Size}}
	if c.Save.Ready() {
		folders = append(folders, Folder{Role: FolderSave, Name: SaveFolder, Items: max(c.Save.Files, 1), Size: max(c.Save.Unpacked, c.Save.Size)})
	}
	if c.KeepPatch && c.Patch != nil {
		folders = append(folders, Folder{Role: FolderPatch, Name: PatchFolder, Items: 1, Size: c.Patch.Size})
	}
	return folders
}

type Progress struct {
	Step    Step
	Running bool
	Done    bool
	Seconds *int
}

func (c Composition) Progress(now time.Time) []Progress {
	out := make([]Progress, len(Steps))
	for i, step := range Steps {
		out[i] = Progress{Step: step}
		index := slices.IndexFunc(c.Runs, func(run StepRun) bool { return run.Step == step })
		if index < 0 {
			continue
		}
		run := c.Runs[index]
		end := now
		if run.Finished != nil {
			end = *run.Finished
			out[i].Done = true
		} else {
			out[i].Running = c.State == StateRunning
		}
		seconds := max(int(end.Sub(run.Started).Seconds()), 0)
		out[i].Seconds = &seconds
	}
	return out
}

type View struct {
	Composition
	Folders  []Folder
	FileName string
	Ahead    int
	Steps    []Progress
}

type NewComposition struct {
	GameID       int
	CreatorID    int
	ResourceID   *int
	TargetFileID *int
	Base         Base
	Details      Details
	Placement    Placement
	KeepPatch    bool
	Note         *string
}

type Upload struct {
	SessionID int
	Name      string
}

type Changes struct {
	Languages    *[]string
	Translation  **download.Translation
	Translators  *[]string
	PatchVersion **string
	ReleaseURL   **string
	GameDir      **string
	PatchDir     **string
	KeepPatch    *bool
}

func (c Changes) apply(composition *Composition) bool {
	if c.Languages != nil {
		composition.Details.Languages = *c.Languages
	}
	if c.Translation != nil {
		composition.Details.Translation = *c.Translation
	}
	if c.Translators != nil {
		composition.Details.Translators = *c.Translators
	}
	if c.PatchVersion != nil {
		composition.Details.PatchVersion = *c.PatchVersion
	}
	if c.ReleaseURL != nil {
		composition.Details.ReleaseURL = *c.ReleaseURL
	}
	if c.KeepPatch != nil {
		composition.KeepPatch = *c.KeepPatch
	}
	if c.GameDir != nil {
		composition.Placement.GameDir = *c.GameDir
	}
	if c.PatchDir != nil {
		composition.Placement.PatchDir = *c.PatchDir
	}
	return c.GameDir != nil || c.PatchDir != nil
}

func (c *Composition) input(role Role) *Input {
	if role == RoleSave {
		return c.Save
	}
	return c.Patch
}

func (c *Composition) setInput(role Role, input *Input) {
	if role == RoleSave {
		c.Save = input
		return
	}
	c.Patch = input
}

func Owner(composition Composition) actor.Actor {
	return actor.Actor{UserID: composition.CreatorID, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
}

var creditVersion = regexp.MustCompile(`(?i)^v(?:er)?\.?\s?\d+(?:\.\d+)*[a-z]?$`)

func MatchOf(entry moyu.Entry) Match {
	match := Match{URL: entry.URL, Translators: []string{}}
	credit := strings.TrimSpace(entry.Translator)
	for _, separator := range []string{"&", "＆"} {
		head, tail, found := cutLast(credit, separator)
		if found && creditVersion.MatchString(strings.TrimSpace(tail)) {
			version := strings.TrimSpace(tail)
			match.Version = &version
			credit = strings.TrimSpace(head)
			break
		}
	}
	for _, name := range strings.Split(credit, "×") {
		if name = strings.TrimSpace(name); name != "" {
			match.Translators = append(match.Translators, name)
		}
	}
	return match
}

func cutLast(text, separator string) (string, string, bool) {
	cut := strings.LastIndex(text, separator)
	if cut < 0 {
		return text, "", false
	}
	return text[:cut], text[cut+len(separator):], true
}

type Lineage struct {
	Current  *View
	Latest   *Composition
	BaseGone bool
}

type RebuildInput struct {
	Upload       Upload
	PatchVersion *string
	Note         *string
}
