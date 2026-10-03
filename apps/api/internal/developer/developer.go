package developer

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
