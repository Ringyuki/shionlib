package game

import "strconv"

type ReferenceSource string

const (
	ReferenceHikarinagi ReferenceSource = "hikarinagi"
	ReferenceVNDB       ReferenceSource = "vndb"
	ReferenceBangumi    ReferenceSource = "bangumi"
)

type Reference struct {
	Source ReferenceSource
	Number int
}

func (r Reference) Key() string {
	if r.Source == ReferenceVNDB {
		return "v" + strconv.Itoa(r.Number)
	}
	return strconv.Itoa(r.Number)
}
