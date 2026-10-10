package walkthrough

import (
	"encoding/json"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type WriteInput struct {
	GameID  int
	Note    *richtext.Document
	Routes  []Route
	Publish bool
}

type Status string

const (
	StatusDraft     Status = "DRAFT"
	StatusPublished Status = "PUBLISHED"
	StatusHidden    Status = "HIDDEN"
	StatusDeleted   Status = "DELETED"
)

func (s Status) Valid() bool {
	return slices.Contains([]Status{StatusDraft, StatusPublished, StatusHidden, StatusDeleted}, s)
}

const (
	MaxNoteLength = 10000
	MaxTextLength = 50000
	GameListLimit = 50
)

type Walkthrough struct {
	ID            int
	GameID        int
	Note          json.RawMessage
	Routes        []Route
	Text          string
	Lang          *string
	Created       time.Time
	Updated       time.Time
	Edited        bool
	Status        Status
	CreatorID     int
	ReviewPending bool
}

type View struct {
	Walkthrough
	Creator user.Summary
}

type Summary struct {
	ID            int
	GameID        int
	RouteCount    int
	Lang          *string
	Created       time.Time
	Updated       time.Time
	Status        Status
	ReviewPending bool
	Creator       user.Summary
	Game          *game.Card
}

type NewWalkthrough struct {
	GameID        int
	Note          json.RawMessage
	Routes        []Route
	Text          string
	Lang          *string
	Status        Status
	CreatorID     int
	ReviewPending bool
}

type Changes struct {
	Note          json.RawMessage
	Routes        []Route
	Text          string
	Lang          *string
	Status        Status
	ReviewPending bool
}

type CreatorFilter struct {
	CreatorID    int
	Statuses     []Status
	ExcludeRated bool
}

type Page = paging.Page

type SortField string

const (
	SortByID      SortField = "id"
	SortByCreated SortField = "created"
	SortByUpdated SortField = "updated"
	SortByStatus  SortField = "status"
)

type AdminFilter struct {
	Search     string
	Status     *Status
	CreatorID  *int
	GameID     *int
	SortBy     SortField
	Descending bool
}

type GameRef struct {
	ID      int
	TitleJP string
	TitleZH string
	TitleEN string
}

type AdminEntry struct {
	Walkthrough
	Creator      user.Summary
	CreatorEmail string
	Game         GameRef
	Moderation   *moderation.Event
}

type AdminDetail struct {
	AdminEntry
	Moderations []moderation.Event
}
