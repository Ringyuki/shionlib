package walkthrough

import (
	"encoding/json"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

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
	MaxTitleLength   = 255
	MaxContentLength = 50000
	MaxHTMLLength    = 100000
)

type Walkthrough struct {
	ID            int
	GameID        int
	Title         string
	Content       json.RawMessage
	HTML          string
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
	ID      int
	GameID  int
	Title   string
	Lang    *string
	Created time.Time
	Updated time.Time
	Edited  bool
	Status  Status
	Creator user.Summary
	Game    *game.Card
}

type NewWalkthrough struct {
	GameID        int
	Title         string
	Content       json.RawMessage
	HTML          string
	Lang          *string
	Status        Status
	CreatorID     int
	ReviewPending bool
}

type Changes struct {
	Title         string
	Content       json.RawMessage
	HTML          string
	Lang          *string
	Status        Status
	ReviewPending bool
}

type GameFilter struct {
	GameID   int
	Status   *Status
	Public   []Status
	ViewerID int
}

type CreatorFilter struct {
	CreatorID    int
	Statuses     []Status
	ExcludeRated bool
}

type Page struct {
	Number int
	Size   int
}

func (p Page) Offset() int {
	return (p.Number - 1) * p.Size
}

type SortField string

const (
	SortByID      SortField = "id"
	SortByTitle   SortField = "title"
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
