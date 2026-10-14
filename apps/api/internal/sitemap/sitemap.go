package sitemap

import (
	"time"
)

type Section string

const (
	SectionGame        Section = "game"
	SectionResource    Section = "resource"
	SectionWalkthrough Section = "walkthrough"
	SectionDeveloper   Section = "developer"
	SectionCharacter   Section = "character"
	SectionTranslator  Section = "translator"
)

var Sections = []Section{SectionGame, SectionResource, SectionWalkthrough, SectionDeveloper, SectionCharacter, SectionTranslator}

const (
	PageSize = 50000
	CacheTTL = time.Hour
)

type Entry struct {
	ID       int
	GameID   int
	Modified *time.Time
}

type SectionPages struct {
	Section Section
	Pages   int
}
