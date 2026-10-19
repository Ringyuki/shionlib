package character

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

type Character struct {
	ID             int
	BID            *string
	VID            *string
	HID            *int
	Image          *string
	ImageThumbHash *string
	NameJP         string
	NameZH         *string
	NameEN         *string
	Aliases        []string
	IntroJP        string
	IntroZH        string
	IntroEN        string
	BloodType      *string
	Height         *int
	Weight         *int
	Bust           *int
	Waist          *int
	Hips           *int
	Cup            *string
	Age            *int
	Birthday       []int
	Gender         []string
	Created        time.Time
	Updated        time.Time
}

type Appearance struct {
	GameID int
	Role   string
	Actor  *string
}

type Detail struct {
	Character
	Appearances []Appearance
}

type GameRef struct {
	ID      int
	TitleJP string
	TitleZH string
	TitleEN string
}

type Summary struct {
	ID             int
	Image          *string
	ImageThumbHash *string
	NameJP         string
	NameZH         *string
	NameEN         *string
	Aliases        []string
	Game           *GameRef
}

func (s Summary) InGame() bool {
	return s.Game != nil
}

type Page = paging.Page

type SortField string

const (
	SortByID      SortField = "id"
	SortByName    SortField = "name"
	SortByCreated SortField = "created"
	SortByUpdated SortField = "updated"
)

type AdminFilter struct {
	Search     string
	SortBy     SortField
	Descending bool
}

type AdminEntry struct {
	ID             int
	NameJP         string
	NameZH         *string
	NameEN         *string
	Image          *string
	ImageThumbHash *string
	Gender         []string
	GamesCount     int
	Created        time.Time
	Updated        time.Time
}
