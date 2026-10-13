package comment

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
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

const MaxContentLength = 10000

type Comment struct {
	ID         int
	Content    json.RawMessage
	Text       string
	GameID     int
	ResourceID *int
	PinnedAt   *time.Time
	ParentID   *int
	RootID     *int
	ReplyCount int
	CreatorID  int
	Status     Status
	Edited     bool
	Created    time.Time
	Updated    time.Time
}

func (c Comment) Pinned() bool {
	return c.PinnedAt != nil
}

func (c Comment) Pinnable() bool {
	return c.ResourceID != nil && c.ParentID == nil && c.Status == StatusVisible
}

type Subject struct {
	GameID     int
	ResourceID int
}

func (s Subject) Holds(c Comment) bool {
	if c.GameID != s.GameID {
		return false
	}
	if s.ResourceID == 0 {
		return c.ResourceID == nil
	}
	return c.ResourceID != nil && *c.ResourceID == s.ResourceID
}

func (s Subject) resource() *int {
	if s.ResourceID == 0 {
		return nil
	}
	id := s.ResourceID
	return &id
}

type ResourceRef struct {
	ID        int
	GameID    int
	CreatorID int
	FileNames []string
}

type ParentRef struct {
	ID      int
	Text    string
	Content json.RawMessage
	Creator user.Summary
}

type Entry struct {
	Comment
	Creator   user.Summary
	Parent    *ParentRef
	LikeCount int
	Liked     bool
	Game      *game.Card
	Resource  *ResourceRef
}

type Order string

const (
	OrderNewest Order = "newest"
	OrderOldest Order = "oldest"
)

type Thread struct {
	Entry
	Replies []Entry
}

type ThreadTotals struct {
	Threads  int
	Comments int
	PinnedID int
}

type ThreadQuery struct {
	Subject Subject
	Order   Order
	Page    Page
	Focus   int
}

type ThreadList struct {
	Threads []Thread
	Totals  ThreadTotals
	Page    int
}

type NewComment struct {
	Content    json.RawMessage
	Text       string
	GameID     int
	ResourceID *int
	CreatorID  int
	ParentID   *int
	RootID     *int
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
	Content  richtext.Document
	ParentID *int
}
