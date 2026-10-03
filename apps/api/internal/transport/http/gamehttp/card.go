package gamehttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type GameCover struct {
	Language string `json:"language" enum:"jp,en,zh,unknown"`
	Type     string `json:"type" enum:"pkgfront,dig"`
	URL      string `json:"url"`
	Dims     []int  `json:"dims"`
	Sexual   int    `json:"sexual"`
	Violence int    `json:"violence"`
}

type GameDeveloperRef struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
}

type GameCredit struct {
	Role      string           `json:"role"`
	Developer GameDeveloperRef `json:"developer"`
}

type GameCard struct {
	ID          int          `json:"id"`
	TitleJP     string       `json:"title_jp"`
	TitleZH     string       `json:"title_zh"`
	TitleEN     string       `json:"title_en"`
	Aliases     []string     `json:"aliases"`
	Type        *string      `json:"type"`
	Covers      []GameCover  `json:"covers"`
	IntroJP     string       `json:"intro_jp"`
	IntroZH     string       `json:"intro_zh"`
	IntroEN     string       `json:"intro_en"`
	ReleaseDate *time.Time   `json:"release_date"`
	Developers  []GameCredit `json:"developers"`
}

func ToGameCard(card game.Card) GameCard {
	out := GameCard{
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
		Covers:      make([]GameCover, len(card.Covers)),
		Developers:  make([]GameCredit, len(card.Developers)),
	}
	for i, cover := range card.Covers {
		out.Covers[i] = GameCover{
			Language: cover.Language,
			Type:     cover.Type,
			URL:      cover.URL,
			Dims:     nonNilInts(cover.Dims),
			Sexual:   cover.Sexual,
			Violence: cover.Violence,
		}
	}
	for i, credit := range card.Developers {
		out.Developers[i] = GameCredit{
			Role:      credit.Role,
			Developer: GameDeveloperRef{ID: credit.Developer.ID, Name: credit.Developer.Name, Aliases: nonNil(credit.Developer.Aliases)},
		}
	}
	return out
}

type GameListItem struct {
	ID          int          `json:"id"`
	Views       int          `json:"views"`
	TitleJP     string       `json:"title_jp"`
	TitleZH     string       `json:"title_zh"`
	TitleEN     string       `json:"title_en"`
	Aliases     []string     `json:"aliases"`
	Type        *string      `json:"type"`
	Covers      []GameCover  `json:"covers"`
	IntroJP     string       `json:"intro_jp"`
	IntroZH     string       `json:"intro_zh"`
	IntroEN     string       `json:"intro_en"`
	ReleaseDate *time.Time   `json:"release_date"`
	Developers  []GameCredit `json:"developers"`
}

func ToGameListItem(card game.Card) GameListItem {
	nested := ToGameCard(card)
	return GameListItem{
		ID:          nested.ID,
		Views:       card.Views,
		TitleJP:     nested.TitleJP,
		TitleZH:     nested.TitleZH,
		TitleEN:     nested.TitleEN,
		Aliases:     nested.Aliases,
		Type:        nested.Type,
		Covers:      nested.Covers,
		ReleaseDate: nested.ReleaseDate,
		Developers:  nested.Developers,
	}
}

func ToGameListItems(cards []game.Card) []GameListItem {
	items := make([]GameListItem, len(cards))
	for i, card := range cards {
		items[i] = ToGameListItem(card)
	}
	return items
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
