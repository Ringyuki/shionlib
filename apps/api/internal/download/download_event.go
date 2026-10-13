package download

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type EventKind string

const (
	EventPublished     EventKind = "published"
	EventFileReplaced  EventKind = "file_replaced"
	EventFileRenamed   EventKind = "file_renamed"
	EventFileAdded     EventKind = "file_added"
	EventFileRemoved   EventKind = "file_removed"
	EventEdited        EventKind = "edited"
	EventReviewCleared EventKind = "review_cleared"
	EventDiscFound     EventKind = "disc_found"
	EventFormRead      EventKind = "form_read"
	EventComposed      EventKind = "composed"
	EventRecomposed    EventKind = "recomposed"
)

const (
	EventListLimit   = 200
	resourceLinkText = "Messages.System.File.Upload.ResourceLinkText"
	resourcePagePath = "/resource/%d"
)

type EventFile struct {
	Name string
	Size int64
}

type EventField string

const (
	FieldPlatforms EventField = "platforms"
	FieldLanguages EventField = "languages"
	FieldSimulator EventField = "simulator"
	FieldNote      EventField = "note"

	FieldTranslation  EventField = "translation"
	FieldTranslators  EventField = "translators"
	FieldPatchVersion EventField = "patch_version"
	FieldReleaseURL   EventField = "release_url"
	FieldEdition      EventField = "edition"
	FieldEditionName  EventField = "edition_name"
	FieldForm         EventField = "form"
	FieldExtras       EventField = "extras"
	FieldBase         EventField = "base"
)

type FieldChange struct {
	Field EventField
	Old   []string
	New   []string
}

type EventData struct {
	Files   []EventFile
	Name    string
	OldName string
	Reason  *string
	OldSize *int64
	NewSize *int64
	Changes []FieldChange
}

type NewEvent struct {
	ResourceID int
	Kind       EventKind
	ActorID    *int
	Data       EventData
}

type Event struct {
	ID         int
	ResourceID int
	Kind       EventKind
	Actor      *user.Summary
	Data       EventData
	Created    time.Time
}

func (r Resource) ChangesTo(changes ResourceChanges) []FieldChange {
	var out []FieldChange
	if !slices.Equal(r.Platforms, changes.Platforms) {
		out = append(out, FieldChange{Field: FieldPlatforms, Old: slices.Clone(r.Platforms), New: slices.Clone(changes.Platforms)})
	}
	if !slices.Equal(r.Languages, changes.Languages) {
		out = append(out, FieldChange{Field: FieldLanguages, Old: slices.Clone(r.Languages), New: slices.Clone(changes.Languages)})
	}
	if before, after := optional(r.Simulator), optional(changes.Simulator); !slices.Equal(before, after) {
		out = append(out, FieldChange{Field: FieldSimulator, Old: before, New: after})
	}
	if changes.Note != nil {
		if before, after := optional(r.Note), optional(changes.Note); !slices.Equal(before, after) {
			out = append(out, FieldChange{Field: FieldNote, Old: before, New: after})
		}
	}
	return append(out, r.Info.changesTo(changes.Info)...)
}

func (i Info) changesTo(next Info) []FieldChange {
	var out []FieldChange
	compare := func(field EventField, before, after []string) {
		if !slices.Equal(before, after) {
			out = append(out, FieldChange{Field: field, Old: before, New: after})
		}
	}
	compare(FieldTranslation, optional((*string)(i.Translation)), optional((*string)(next.Translation)))
	compare(FieldTranslators, translatorNames(i.Translators), translatorNames(next.Translators))
	compare(FieldPatchVersion, optional(i.PatchVersion), optional(next.PatchVersion))
	compare(FieldReleaseURL, optional(i.ReleaseURL), optional(next.ReleaseURL))
	compare(FieldEdition, optional((*string)(i.Edition)), optional((*string)(next.Edition)))
	compare(FieldEditionName, optional(i.EditionName), optional(next.EditionName))
	compare(FieldForm, optional((*string)(i.Form)), optional((*string)(next.Form)))
	compare(FieldExtras, slices.Clone(i.Extras), slices.Clone(next.Extras))
	return out
}

func translatorNames(refs []translator.Ref) []string {
	names := make([]string, len(refs))
	for i, ref := range refs {
		names[i] = ref.Name
	}
	return names
}

func optional(value *string) []string {
	if value == nil || *value == "" {
		return []string{}
	}
	return []string{*value}
}

type ResourceDetail struct {
	GameResource
	Game game.Card
}
