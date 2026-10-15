package search

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const (
	ImageMaxBytes       = 20 << 20
	ImageLongestSide    = 2048
	ImageCacheTTL       = 7 * 24 * time.Hour
	CharacterCandidates = 5
	ImageLookups        = 4
)

type Box struct {
	Left   float64
	Top    float64
	Right  float64
	Bottom float64
}

type Sighting struct {
	Box    Box
	Name   string
	Work   string
	Unsure bool
}

type ImageSource struct {
	Name string
	URL  string
}

type Spotted struct {
	Sighting
	GameID    *int
	Character *character.Summary
}

type ImageResults struct {
	Source     ImageSource
	Games      []game.Card
	Unlisted   []string
	Characters []Spotted
}
