package game

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
)

const CharacterRoleSide = "side"

type Image struct {
	URL      string
	Dims     []int
	Sexual   int
	Violence int
}

func (i Image) Rated() bool {
	return i.Sexual > 0
}

type Tag struct {
	ID      int
	Name    string
	Aliases []string
	Count   int
}

type TagLink struct {
	Alias *string
	Tag   Tag
}

type Staff struct {
	Name string
	Role string
}

type ExtraInfo struct {
	Key   string
	Value string
}

type Link struct {
	ID    int
	Name  string
	Label string
	URL   string
}

type CharacterCredit struct {
	Role      string
	Image     *string
	Actor     *string
	Character character.Character
}

type Relation struct {
	ID          int
	Kind        string
	ToGameID    int
	TargetRated bool
	Target      Card
}

type Detail struct {
	ID             int
	VID            *string
	BID            *string
	HID            *int
	TitleJP        string
	TitleZH        string
	TitleEN        string
	Aliases        []string
	IntroJP        string
	IntroZH        string
	IntroEN        string
	ReleaseDate    *time.Time
	ReleaseDateTBA bool
	NSFW           bool
	Type           *string
	Platforms      []string
	ExtraInfo      []ExtraInfo
	Staffs         []Staff
	Covers         []Cover
	Images         []Image
	ImagesWithheld bool
	Developers     []Credit
	Characters     []CharacterCredit
	Tags           []TagLink
	Links          []Link
	Relations      []Relation
}

func (d Detail) Rated() bool {
	return d.NSFW || slices.ContainsFunc(d.Covers, Cover.Rated)
}

func (d Detail) visibleTo(viewer actor.Actor) Detail {
	if viewer.IncludesRated() {
		return d
	}
	visible := d
	visible.Covers = slices.DeleteFunc(slices.Clone(d.Covers), Cover.Rated)
	visible.Images = slices.DeleteFunc(slices.Clone(d.Images), Image.Rated)
	return visible
}

type ExternalIDs struct {
	BangumiID *string
	VNDBID    *string
}
