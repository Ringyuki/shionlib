package game

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

const RecentUpdateRetention = 30 * 24 * time.Hour

const CardTagLimit = 3

const CommonTagShare = 0.1

const DateTagPattern = `^[0-9]{4}([-年][0-9]{1,2}月?|年|s)?$`

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
	Masked   bool
}

func (c Cover) Rated() bool {
	return c.Sexual > 0
}

func shownCovers(covers []Cover, viewer actor.Actor, masker PictureMasker) []Cover {
	if viewer.IncludesRated() {
		return covers
	}
	shown := make([]Cover, 0, len(covers))
	for _, cover := range covers {
		if !cover.Rated() {
			shown = append(shown, cover)
			continue
		}
		if !viewer.MasksRated() {
			continue
		}
		if masked, ok := masker.Mask(cover.URL); ok {
			cover.URL, cover.Masked = masked, true
			shown = append(shown, cover)
		}
	}
	return shown
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

type LatestResource struct {
	At        time.Time
	Size      int64
	Platforms []string
	Languages []string
}

type ResourceSummary struct {
	Count     int
	Downloads int
	Platforms []string
	Languages []string
	Latest    *LatestResource
}

type TagRef struct {
	ID   int
	Name string
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
	Resources   ResourceSummary
	Tags        []TagRef
}

func (c Card) VisibleTo(viewer actor.Actor, masker PictureMasker) Card {
	visible := c
	visible.Covers = shownCovers(c.Covers, viewer, masker)
	return visible
}

type Page = paging.Page

type Visibility struct {
	ExcludeRated      bool
	OnlyWithResources bool
}
