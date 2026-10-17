package moyu

import (
	"time"
)

const (
	CacheTTL         = 5 * time.Minute
	FailureTTL       = time.Minute
	WorksTTL         = 24 * time.Hour
	RequestTimeout   = 3 * time.Second
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
	Titles   []string
	Released *time.Time
}

type Work struct {
	ID       string
	Titles   []string
	Released *time.Time
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
