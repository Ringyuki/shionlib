package download

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
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
	return out
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
