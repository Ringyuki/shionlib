package developer

import "time"

type ExtraInfo struct {
	Key   string
	Value string
}

type Developer struct {
	ID        int
	HID       *int
	Name      string
	Aliases   []string
	Logo      *string
	IntroJP   string
	IntroZH   string
	IntroEN   string
	Website   *string
	ExtraInfo []ExtraInfo
	ParentID  *int
}

type Summary struct {
	ID         int
	Name       string
	Aliases    []string
	Logo       *string
	WorksCount int
}

type Page struct {
	Number int
	Size   int
}

func (p Page) Offset() int {
	return (p.Number - 1) * p.Size
}

type SortField string

const (
	SortByID      SortField = "id"
	SortByName    SortField = "name"
	SortByCreated SortField = "created"
	SortByUpdated SortField = "updated"
)

type AdminFilter struct {
	Search     string
	SortBy     SortField
	Descending bool
}

type AdminEntry struct {
	ID         int
	Name       string
	Logo       *string
	GamesCount int
	Created    time.Time
	Updated    time.Time
}
