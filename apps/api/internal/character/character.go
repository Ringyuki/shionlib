package character

import "time"

type Character struct {
	ID        int
	BID       *string
	VID       *string
	HID       *int
	Image     *string
	NameJP    string
	NameZH    *string
	NameEN    *string
	Aliases   []string
	IntroJP   string
	IntroZH   string
	IntroEN   string
	BloodType *string
	Height    *int
	Weight    *int
	Bust      *int
	Waist     *int
	Hips      *int
	Cup       *string
	Age       *int
	Birthday  []int
	Gender    []string
	Created   time.Time
	Updated   time.Time
}

type Page struct {
	Number int
	Size   int
}

func (p Page) Offset() int {
	return (p.Number - 1) * p.Size
}
