package game

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

const RecentUpdateRetention = 30 * 24 * time.Hour

type Status int

const (
	StatusVisible Status = 1
	StatusHidden  Status = 2
)

func (s Status) Valid() bool {
	return s == StatusVisible || s == StatusHidden
}

type Cover struct {
	Language string
	Type     string
	URL      string
	Dims     []int
	Sexual   int
	Violence int
}

func (c Cover) Rated() bool {
	return c.Sexual > 0
}

type DeveloperRef struct {
	ID      int
	Name    string
	Aliases []string
}

type Credit struct {
	Role      string
	Developer DeveloperRef
}

type Card struct {
	ID          int
	Views       int
	TitleJP     string
	TitleZH     string
	TitleEN     string
	Aliases     []string
	Type        *string
	Covers      []Cover
	IntroJP     string
	IntroZH     string
	IntroEN     string
	ReleaseDate *time.Time
	Developers  []Credit
}

func (c Card) VisibleTo(viewer actor.Actor) Card {
	if viewer.IncludesRated() {
		return c
	}
	visible := c
	visible.Covers = slices.DeleteFunc(slices.Clone(c.Covers), Cover.Rated)
	return visible
}

type Page = paging.Page

type Visibility struct {
	ExcludeRated      bool
	OnlyWithResources bool
}
