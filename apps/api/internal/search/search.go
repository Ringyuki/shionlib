package search

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Window string

const (
	WindowHour     Window = "1h"
	WindowSixHours Window = "6h"
	WindowDay      Window = "1d"
)

var Windows = []Window{WindowHour, WindowSixHours, WindowDay}

const (
	MaxRecordedQueryLength = 64
	DecayFactor            = 0.9
	MinScore               = 0.01
	UpstreamCacheTTL       = time.Minute
	ResourceWindow         = 100
)

var Kinds = []catalog.Entity{catalog.EntityGame, catalog.EntityDeveloper, catalog.EntityCharacter}

type Query struct {
	Q                       string
	Kinds                   []catalog.Entity
	Page                    int
	Size                    int
	IncludeWithoutResources bool
}

type Section[T any] struct {
	Items []T
	Total int
}

type Results struct {
	Games      Section[game.Card]
	Developers Section[developer.Summary]
	Characters Section[character.Summary]
}

type UpstreamPage struct {
	ExternalIDs []string
	Total       int
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
