package catalog

import "time"

type Entity string

const (
	EntityGame      Entity = "game"
	EntityDeveloper Entity = "developer"
	EntityCharacter Entity = "character"
)

func (e Entity) Valid() bool {
	return e == EntityGame || e == EntityDeveloper || e == EntityCharacter
}

type Ref struct {
	Source     string
	Entity     Entity
	ExternalID string
}

type Localized struct {
	Origin     string
	OriginLang string
	Translated *string
	English    *string
}

type Media struct {
	URL      string
	Width    *int
	Height   *int
	Sexual   int
	Violence int
}

type Cover struct {
	Media
	Votes    int
	Language string
	Kind     string
}

type Link struct {
	Name  string
	Label string
	URL   string
}

type Staff struct {
	Name string
	Role string
}

type DeveloperCredit struct {
	ExternalID string
	Name       string
	Aliases    []string
	Role       string
	Logo       *Media
}

type CharacterCredit struct {
	ExternalID string
	Name       string
	Translated *string
	Image      *Media
	Role       string
	Actors     []string
}

type Relation struct {
	ExternalID string
	Type       string
}

type ExternalIDs struct {
	VNDB    *string
	Bangumi *string
}

type GameSnapshot struct {
	ExternalID     string
	Title          Localized
	Intro          Localized
	Aliases        []string
	ReleaseDate    *time.Time
	ReleaseDateTBD bool
	Type           *string
	Platforms      []string
	NSFW           bool
	Covers         []Cover
	Images         []Media
	Tags           []string
	Links          []Link
	Staff          []Staff
	Developers     []DeveloperCredit
	Characters     []CharacterCredit
	Relations      []Relation
	External       ExternalIDs
	Revision       string
}

type DeveloperSnapshot struct {
	ExternalID string
	Name       string
	Aliases    []string
	Intro      Localized
	Website    *string
	Logo       *Media
	Extra      []KeyValue
	External   ExternalIDs
	Revision   string
}

type CharacterSnapshot struct {
	ExternalID string
	Name       Localized
	Aliases    []string
	Intro      Localized
	Image      *Media
	Gender     []string
	BloodType  *string
	Height     *int
	Weight     *int
	Bust       *int
	Waist      *int
	Hips       *int
	Cup        *string
	Age        *int
	Birthday   []int
	External   ExternalIDs
	Revision   string
}

type ChangeKind string

const (
	ChangeUpsert ChangeKind = "UPSERT"
	ChangeDelete ChangeKind = "DELETE"
	ChangeMerge  ChangeKind = "MERGE"
)

type Change struct {
	Entity     Entity
	ExternalID string
	Kind       ChangeKind
	MergedInto string
}

type ChangeBatch struct {
	Changes []Change
	Cursor  string
	HasMore bool
}

type SearchHit struct {
	ExternalID string
	Title      string
	Subtitle   *string
	Developer  *string
	CoverURL   *string
}
