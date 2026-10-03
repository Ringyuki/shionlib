package favorite

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

const (
	MaxNameLength        = 255
	MaxDescriptionLength = 2000
	MaxNoteLength        = 2000
)

type Favorite struct {
	ID          int
	UserID      int
	Name        string
	Description *string
	IsPrivate   bool
	Default     bool
	Created     time.Time
	Updated     time.Time
}

type Summary struct {
	Favorite
	GameCount  int
	IsFavorite *bool
}

type Item struct {
	ID         int
	FavoriteID int
	OwnerID    int
	GameID     int
	Note       *string
	Created    time.Time
}

type ItemView struct {
	ID   int
	Note *string
	Game game.Card
}

type NewFavorite struct {
	UserID      int
	Name        string
	Description *string
	IsPrivate   bool
}

type Changes struct {
	Name        *string
	Description *string
	IsPrivate   *bool
}

type NewItem struct {
	FavoriteID int
	GameID     int
	Note       *string
}

type ListFilter struct {
	OwnerID     int
	PublicOnly  bool
	ContainGame *int
}

type Page = paging.Page

type CreateInput struct {
	Name        string
	Description *string
	IsPrivate   bool
}

type ListQuery struct {
	UserID *int
	GameID *int
}
