package search

import (
	"time"
)

const (
	IndexJobKind     = "search_index"
	rebuildBatchSize = 500
)

type Document struct {
	ID                int
	TitleJP           string
	TitleZH           string
	TitleEN           string
	IntroJP           string
	IntroZH           string
	IntroEN           string
	Aliases           []string
	Tags              []string
	Platform          []string
	NSFW              bool
	MaxCoverSexual    int
	ReleaseDate       *time.Time
	Developers        []DocumentDeveloper
	CharacterActors   []string
	CharacterNamesJP  []string
	CharacterNamesZH  []string
	CharacterNamesEN  []string
	CharacterAliases  []string
	CharacterIntrosJP []string
	CharacterIntrosZH []string
	CharacterIntrosEN []string
	Staffs            []DocumentStaff
}

type DocumentDeveloper struct {
	ID      int
	Name    string
	Role    *string
	Aliases []string
}

type DocumentStaff struct {
	Name string
	Role string
}
