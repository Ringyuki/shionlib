package comment

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type Status int

const (
	StatusVisible Status = 1
	StatusPending Status = 2
	StatusBlocked Status = 3
)

func (s Status) Valid() bool {
	return s == StatusVisible || s == StatusPending || s == StatusBlocked
}

const (
	MaxContentLength = 10000
	MaxHTMLLength    = 100000
)

type Comment struct {
	ID         int
	Content    json.RawMessage
	HTML       *string
	GameID     int
	ParentID   *int
	RootID     *int
	ReplyCount int
	CreatorID  int
	Status     Status
	Edited     bool
	Created    time.Time
	Updated    time.Time
}

type ParentRef struct {
	ID      int
	HTML    *string
	Creator user.Summary
}

type Entry struct {
	Comment
	Creator   user.Summary
	Parent    *ParentRef
	LikeCount int
	Liked     bool
	Game      *game.Card
}

type NewComment struct {
	Content   json.RawMessage
	HTML      string
	GameID    int
	CreatorID int
	ParentID  *int
	RootID    *int
}

type CreatorFilter struct {
	CreatorID    int
	ViewerID     int
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
	Comment
	Creator      user.Summary
	CreatorEmail string
	Parent       *ParentRef
	Game         GameRef
	LikeCount    int
	Moderation   *moderation.Event
}

type AdminDetail struct {
	AdminEntry
	Moderations []moderation.Event
}

type StatusChange struct {
	Status      Status
	TopCategory *moderation.Category
	Reason      *string
	Evidence    *string
	Notify      *bool
}

type CreateInput struct {
	Content  lexical.Document
	ParentID *int
}
