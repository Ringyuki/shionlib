package moyu

import (
	"time"
)

const (
	CacheTTL         = 5 * time.Minute
	FailureTTL       = time.Minute
	WorksTTL         = 24 * time.Hour
	RequestTimeout   = 3 * time.Second
	MaxPages         = 20
	EntriesKeyPrefix = "moyu:entries:game:"
	WorksKeyPrefix   = "moyu:works:"
)

type Source string

const (
	SourceVNDB    Source = "vndb"
	SourceBangumi Source = "bangumi"
)

type Anchor struct {
	Source Source
	ID     string
}

type Game struct {
	Anchors  []Anchor
	Assigned bool
	Pages    []string
}

func (g Game) Findable() bool {
	if g.Assigned {
		return len(g.Pages) > 0
	}
	return len(g.Anchors) > 0
}

func (g Game) VNDBID() string {
	for _, anchor := range g.Anchors {
		if anchor.Source == SourceVNDB {
			return anchor.ID
		}
	}
	return ""
}

type PageQuery struct {
	VNDBID string
	Works  []string
	IDs    []string
}

type Page struct {
	ID        string
	URL       string
	VNDBID    string
	WorkID    string
	Title     string
	Resources int
	Via       *Anchor
}

type Assignment struct {
	Game     Game
	Matched  []Page
	Assigned []Page
}

type Kind string

const (
	KindPatch Kind = "patch"
	KindSave  Kind = "save"
)

type Translation string

const (
	TranslationGroup   Translation = "group"
	TranslationMachine Translation = "machine"
)

type Publisher struct {
	Name   string
	Avatar string
}

type Entry struct {
	ID          string
	Kind        Kind
	Name        string
	Size        *int64
	Hash        string
	Languages   []string
	Platforms   []string
	Translation *Translation
	Translator  string
	Model       string
	Downloads   int
	URL         string
	Updated     time.Time
	Publisher   *Publisher
}
