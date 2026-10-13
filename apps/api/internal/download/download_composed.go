package download

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type ComposedDraft struct {
	GameID    int
	Platforms []string
	Languages []string
	Simulator *string
	Info      InfoInput
}

type ComposedFile struct {
	ResourceID   int
	Name         string
	LocalPath    string
	Size         int64
	SHA256       string
	InspectionID int
	Changes      []FieldChange
}

type ComposedReplacement struct {
	FileID       int
	OperatorID   int
	Name         string
	LocalPath    string
	Size         int64
	SHA256       string
	InspectionID int
	PatchVersion *string
	Extras       []string
	Reason       *string
}

type Adoption struct {
	InspectionID int
	SHA256       string
}

type StoredContent struct {
	Name          string
	Size          int64
	HashAlgorithm upload.HashAlgorithm
	Hash          string
	SHA256        string
	InspectionID  int
	StorageKey    string
}

func (r GameResource) MainFiles() []File {
	files := make([]File, len(r.Files))
	for i, file := range r.Files {
		files[i] = file.File
	}
	return mainFiles(files)
}

func SafeSegment(text string) string {
	return nameSegment(text)
}

func composedChanges(resource Resource, version *string, extras []string) (ResourceChanges, []FieldChange) {
	changes := ResourceChanges{Platforms: resource.Platforms, Languages: resource.Languages, Simulator: resource.Simulator, Note: resource.Note, Info: resource.Info}
	changes.Info.PatchVersion = version
	changes.Info.Extras = extras
	return changes, resource.Info.changesTo(changes.Info)
}
