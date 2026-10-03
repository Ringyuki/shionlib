package search

import "github.com/Ringyuki/shionlib/apps/api/internal/game"

type Window string

const (
	WindowHour     Window = "1h"
	WindowSixHours Window = "6h"
	WindowDay      Window = "1d"
)

var Windows = []Window{WindowHour, WindowSixHours, WindowDay}

const (
	MaxCandidatesPerPrefix = 200
	MaxRecordedQueryLength = 64
	DecayFactor            = 0.9
	MinScore               = 0.01
)

type Page struct {
	Number int
	Size   int
}

type Query struct {
	Q    string
	Tag  string
	Page Page
}

type Criteria struct {
	Q                 string
	Tag               string
	ExcludeRated      bool
	OnlyWithResources bool
	Page              Page
}

type Highlight struct {
	TitleJP *string
	TitleZH *string
	TitleEN *string
	IntroJP *string
	IntroZH *string
	IntroEN *string
	Aliases []string
}

type Hit struct {
	GameID    int
	Highlight *Highlight
}

type Result struct {
	Hits       []Hit
	Total      int
	TotalPages int
}

type Item struct {
	Card      game.Card
	Highlight *Highlight
}

type GamePage struct {
	Items      []Item
	Total      int
	TotalPages int
}

type Tag struct {
	ID      int
	Name    string
	Count   int
	Aliases []string
}

type TagMatch struct {
	Tag
	DisplayName string
}

type Term struct {
	Query string
	Score float64
}

type RecordSearchJob struct {
	Query string `json:"query"`
}

func (RecordSearchJob) Kind() string {
	return "search_analytics"
}
