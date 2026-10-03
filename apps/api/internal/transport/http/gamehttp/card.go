package gamehttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Cover struct {
	Language string `json:"language" enum:"jp,en,zh,unknown"`
	Type     string `json:"type" enum:"pkgfront,dig"`
	URL      string `json:"url"`
	Dims     []int  `json:"dims"`
	Sexual   int    `json:"sexual"`
	Violence int    `json:"violence"`
}

type DeveloperRef struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
}

type Credit struct {
	Role      string       `json:"role"`
	Developer DeveloperRef `json:"developer"`
}

type Card struct {
	ID          int        `json:"id"`
	TitleJP     string     `json:"title_jp"`
	TitleZH     string     `json:"title_zh"`
	TitleEN     string     `json:"title_en"`
	Aliases     []string   `json:"aliases"`
	Type        *string    `json:"type"`
	Covers      []Cover    `json:"covers"`
	IntroJP     string     `json:"intro_jp"`
	IntroZH     string     `json:"intro_zh"`
	IntroEN     string     `json:"intro_en"`
	ReleaseDate *time.Time `json:"release_date"`
	Developers  []Credit   `json:"developers"`
}

func ToCard(card game.Card) Card {
	out := Card{
		ID:          card.ID,
		TitleJP:     card.TitleJP,
		TitleZH:     card.TitleZH,
		TitleEN:     card.TitleEN,
		Aliases:     nonNil(card.Aliases),
		Type:        card.Type,
		IntroJP:     card.IntroJP,
		IntroZH:     card.IntroZH,
		IntroEN:     card.IntroEN,
		ReleaseDate: card.ReleaseDate,
		Covers:      make([]Cover, len(card.Covers)),
		Developers:  make([]Credit, len(card.Developers)),
	}
	for i, cover := range card.Covers {
		out.Covers[i] = Cover{
			Language: cover.Language,
			Type:     cover.Type,
			URL:      cover.URL,
			Dims:     nonNilInts(cover.Dims),
			Sexual:   cover.Sexual,
			Violence: cover.Violence,
		}
	}
	for i, credit := range card.Developers {
		out.Developers[i] = Credit{
			Role:      credit.Role,
			Developer: DeveloperRef{ID: credit.Developer.ID, Name: credit.Developer.Name, Aliases: nonNil(credit.Developer.Aliases)},
		}
	}
	return out
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
