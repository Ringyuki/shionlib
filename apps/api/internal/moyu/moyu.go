package moyu

import (
	"time"
)

const (
	CacheTTL       = 5 * time.Minute
	FailureTTL     = time.Minute
	RequestTimeout = 3 * time.Second
	CacheKeyPrefix = "moyu:entries:vndb:"
)

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
