package characterhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type characterPath struct {
	ID int `path:"id"`
}

type listCharactersInput struct {
	httpapi.PageQuery
	Q string `query:"q" doc:"Matches names and aliases"`
}

type characterListItemDTO struct {
	BID       *string  `json:"b_id"`
	VID       *string  `json:"v_id"`
	ID        int      `json:"id"`
	NameJP    string   `json:"name_jp"`
	NameZH    *string  `json:"name_zh"`
	NameEN    *string  `json:"name_en"`
	Aliases   []string `json:"aliases"`
	IntroJP   string   `json:"intro_jp"`
	IntroZH   string   `json:"intro_zh"`
	IntroEN   string   `json:"intro_en"`
	Image     *string  `json:"image"`
	BloodType *string  `json:"blood_type" enum:"a,b,ab,o"`
	Height    *int     `json:"height"`
	Weight    *int     `json:"weight"`
	Bust      *int     `json:"bust"`
	Waist     *int     `json:"waist"`
	Hips      *int     `json:"hips"`
	Cup       *string  `json:"cup"`
	Age       *int     `json:"age"`
	Birthday  []int    `json:"birthday"`
	Gender    []string `json:"gender"`
}

type characterDetailDTO struct {
	ID        int      `json:"id"`
	HID       *int     `json:"h_id"`
	NameJP    string   `json:"name_jp"`
	NameZH    string   `json:"name_zh"`
	NameEN    string   `json:"name_en"`
	Aliases   []string `json:"aliases"`
	IntroJP   string   `json:"intro_jp"`
	IntroZH   string   `json:"intro_zh"`
	IntroEN   string   `json:"intro_en"`
	Image     *string  `json:"image"`
	BloodType *string  `json:"blood_type" enum:"a,b,ab,o"`
	Height    *int     `json:"height"`
	Weight    *int     `json:"weight"`
	Bust      *int     `json:"bust"`
	Waist     *int     `json:"waist"`
	Hips      *int     `json:"hips"`
	Cup       *string  `json:"cup"`
	Age       *int     `json:"age"`
	Birthday  []int    `json:"birthday"`
	Gender    []string `json:"gender"`
}

type deletedCharacterDTO struct {
	ID        int       `json:"id"`
	BID       *string   `json:"b_id"`
	VID       *string   `json:"v_id"`
	HID       *int      `json:"h_id"`
	Image     *string   `json:"image"`
	NameJP    string    `json:"name_jp"`
	NameZH    *string   `json:"name_zh"`
	NameEN    *string   `json:"name_en"`
	Aliases   []string  `json:"aliases"`
	IntroJP   string    `json:"intro_jp"`
	IntroZH   string    `json:"intro_zh"`
	IntroEN   string    `json:"intro_en"`
	BloodType *string   `json:"blood_type" enum:"a,b,ab,o"`
	Height    *int      `json:"height"`
	Weight    *int      `json:"weight"`
	Bust      *int      `json:"bust"`
	Waist     *int      `json:"waist"`
	Hips      *int      `json:"hips"`
	Cup       *string   `json:"cup"`
	Age       *int      `json:"age"`
	Birthday  []int     `json:"birthday"`
	Gender    []string  `json:"gender"`
	Created   time.Time `json:"created"`
	Updated   time.Time `json:"updated"`
}

func toListItemDTO(c character.Character) characterListItemDTO {
	return characterListItemDTO{
		BID: c.BID, VID: c.VID, ID: c.ID, NameJP: c.NameJP, NameZH: c.NameZH, NameEN: c.NameEN, Aliases: nonNil(c.Aliases),
		IntroJP: c.IntroJP, IntroZH: c.IntroZH, IntroEN: c.IntroEN, Image: c.Image, BloodType: c.BloodType,
		Height: c.Height, Weight: c.Weight, Bust: c.Bust, Waist: c.Waist, Hips: c.Hips, Cup: c.Cup, Age: c.Age,
		Birthday: nonNilInts(c.Birthday), Gender: nonNil(c.Gender),
	}
}

func toDetailDTO(c character.Character) characterDetailDTO {
	return characterDetailDTO{
		ID: c.ID, HID: c.HID, NameJP: c.NameJP, NameZH: valueOrEmpty(c.NameZH), NameEN: valueOrEmpty(c.NameEN), Aliases: nonNil(c.Aliases),
		IntroJP: c.IntroJP, IntroZH: c.IntroZH, IntroEN: c.IntroEN, Image: c.Image, BloodType: c.BloodType,
		Height: c.Height, Weight: c.Weight, Bust: c.Bust, Waist: c.Waist, Hips: c.Hips, Cup: c.Cup, Age: c.Age,
		Birthday: nonNilInts(c.Birthday), Gender: nonNil(c.Gender),
	}
}

func toDeletedDTO(c character.Character) deletedCharacterDTO {
	return deletedCharacterDTO{
		ID: c.ID, BID: c.BID, VID: c.VID, HID: c.HID, Image: c.Image, NameJP: c.NameJP, NameZH: c.NameZH, NameEN: c.NameEN,
		Aliases: nonNil(c.Aliases), IntroJP: c.IntroJP, IntroZH: c.IntroZH, IntroEN: c.IntroEN, BloodType: c.BloodType,
		Height: c.Height, Weight: c.Weight, Bust: c.Bust, Waist: c.Waist, Hips: c.Hips, Cup: c.Cup, Age: c.Age,
		Birthday: nonNilInts(c.Birthday), Gender: nonNil(c.Gender), Created: c.Created.UTC(), Updated: c.Updated.UTC(),
	}
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func nonNilInts(values []int) []int {
	if values == nil {
		return []int{}
	}
	return values
}
