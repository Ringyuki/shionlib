package indexing

import (
	"strconv"
	"time"
)

type ChangeKind string

const (
	ChangeResource    ChangeKind = "resource"
	ChangeWalkthrough ChangeKind = "walkthrough"
)

const (
	IndexedLocale = "zh"
	BatchLimit    = 10000
)

type Change struct {
	Kind   ChangeKind
	ID     int
	GameID int
	At     time.Time
}

func (c Change) Paths() []string {
	game := "/" + IndexedLocale + "/game/" + strconv.Itoa(c.GameID)
	switch c.Kind {
	case ChangeResource:
		return []string{"/" + IndexedLocale + "/resource/" + strconv.Itoa(c.ID), game}
	case ChangeWalkthrough:
		return []string{game + "/walkthrough/" + strconv.Itoa(c.ID)}
	default:
		return nil
	}
}
