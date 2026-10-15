package searchhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
)

type searchGameSectionDTO struct {
	Items []gamehttp.GameListItemDTO `json:"items"`
	Total int                        `json:"total" doc:"Matches at the catalog source, including entries not listed here"`
}

type searchDeveloperDTO struct {
	ID         int      `json:"id"`
	Name       string   `json:"name"`
	Aliases    []string `json:"aliases"`
	Logo       *string  `json:"logo"`
	WorksCount int      `json:"works_count"`
}

type searchDeveloperSectionDTO struct {
	Items []searchDeveloperDTO `json:"items"`
	Total int                  `json:"total" doc:"Matches at the catalog source, including entries not listed here"`
}

type searchCharacterGameDTO struct {
	_       struct{} `nullable:"true"`
	ID      int      `json:"id"`
	TitleJP string   `json:"title_jp"`
	TitleZH string   `json:"title_zh"`
	TitleEN string   `json:"title_en"`
}

type searchCharacterDTO struct {
	ID      int                     `json:"id"`
	Image   *string                 `json:"image"`
	NameJP  string                  `json:"name_jp"`
	NameZH  *string                 `json:"name_zh"`
	NameEN  *string                 `json:"name_en"`
	Aliases []string                `json:"aliases"`
	Game    *searchCharacterGameDTO `json:"game" doc:"First visible game the character appears in"`
}

type searchCharacterSectionDTO struct {
	Items []searchCharacterDTO `json:"items"`
	Total int                  `json:"total" doc:"Matches at the catalog source, including entries not listed here"`
}

type searchResultsDTO struct {
	Games      searchGameSectionDTO      `json:"games"`
	Developers searchDeveloperSectionDTO `json:"developers"`
	Characters searchCharacterSectionDTO `json:"characters"`
}

type searchImageSourceDTO struct {
	Name string `json:"name" doc:"Service that recognized the picture, credited beside the results"`
	URL  string `json:"url"`
}

type searchImageBoxDTO struct {
	Left   float64 `json:"left" minimum:"0" maximum:"1" doc:"Share of the picture's width"`
	Top    float64 `json:"top" minimum:"0" maximum:"1" doc:"Share of the picture's height"`
	Right  float64 `json:"right" minimum:"0" maximum:"1" doc:"Share of the picture's width"`
	Bottom float64 `json:"bottom" minimum:"0" maximum:"1" doc:"Share of the picture's height"`
}

type searchImageCharacterDTO struct {
	_      struct{} `nullable:"true"`
	ID     int      `json:"id"`
	Image  *string  `json:"image"`
	NameJP string   `json:"name_jp"`
	NameZH *string  `json:"name_zh"`
	NameEN *string  `json:"name_en"`
}

type searchSightingDTO struct {
	Box       searchImageBoxDTO        `json:"box" doc:"Where the character is in the picture"`
	Name      string                   `json:"name" doc:"Name the recognizer gave the character"`
	Work      string                   `json:"work" doc:"Title the recognizer gave the work"`
	Unsure    bool                     `json:"unsure" doc:"The recognizer is not confident about this character"`
	GameID    *int                     `json:"game_id" doc:"Game in the library the work matched; it is listed in games"`
	Character *searchImageCharacterDTO `json:"character" doc:"Character of that game the name matched"`
}

type searchImageDTO struct {
	Source     searchImageSourceDTO       `json:"source"`
	Games      []gamehttp.GameListItemDTO `json:"games" doc:"Games the recognized works matched, each once, in the order they were recognized"`
	Unlisted   []string                   `json:"unlisted_works" doc:"Recognized works the library has no game for"`
	Characters []searchSightingDTO        `json:"characters" doc:"Every character recognized, in the recognizer's order"`
}

type searchTagDTO struct {
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	Count       int      `json:"count"`
	Aliases     []string `json:"aliases"`
	DisplayName string   `json:"display_name"`
}

type searchTermDTO struct {
	Query string  `json:"query"`
	Score float64 `json:"score"`
}

func toResultsDTO(results search.Results) searchResultsDTO {
	out := searchResultsDTO{
		Games:      searchGameSectionDTO{Items: make([]gamehttp.GameListItemDTO, len(results.Games.Items)), Total: results.Games.Total},
		Developers: searchDeveloperSectionDTO{Items: make([]searchDeveloperDTO, len(results.Developers.Items)), Total: results.Developers.Total},
		Characters: searchCharacterSectionDTO{Items: make([]searchCharacterDTO, len(results.Characters.Items)), Total: results.Characters.Total},
	}
	for i, card := range results.Games.Items {
		out.Games.Items[i] = gamehttp.ToGameListItem(card)
	}
	for i, summary := range results.Developers.Items {
		out.Developers.Items[i] = toDeveloperDTO(summary)
	}
	for i, summary := range results.Characters.Items {
		out.Characters.Items[i] = toCharacterDTO(summary)
	}
	return out
}

func toImageDTO(results search.ImageResults) searchImageDTO {
	out := searchImageDTO{
		Source:     searchImageSourceDTO{Name: results.Source.Name, URL: results.Source.URL},
		Games:      make([]gamehttp.GameListItemDTO, len(results.Games)),
		Unlisted:   nonNil(results.Unlisted),
		Characters: make([]searchSightingDTO, len(results.Characters)),
	}
	for i, card := range results.Games {
		out.Games[i] = gamehttp.ToGameListItem(card)
	}
	for i, spotted := range results.Characters {
		out.Characters[i] = searchSightingDTO{
			Box:    searchImageBoxDTO(spotted.Box),
			Name:   spotted.Name,
			Work:   spotted.Work,
			Unsure: spotted.Unsure,
			GameID: spotted.GameID,
		}
		if found := spotted.Character; found != nil {
			out.Characters[i].Character = &searchImageCharacterDTO{ID: found.ID, Image: found.Image, NameJP: found.NameJP, NameZH: found.NameZH, NameEN: found.NameEN}
		}
	}
	return out
}

func toDeveloperDTO(summary developer.Summary) searchDeveloperDTO {
	return searchDeveloperDTO{ID: summary.ID, Name: summary.Name, Aliases: nonNil(summary.Aliases), Logo: summary.Logo, WorksCount: summary.WorksCount}
}

func toCharacterDTO(summary character.Summary) searchCharacterDTO {
	out := searchCharacterDTO{ID: summary.ID, Image: summary.Image, NameJP: summary.NameJP, NameZH: summary.NameZH, NameEN: summary.NameEN, Aliases: nonNil(summary.Aliases)}
	if summary.Game != nil {
		out.Game = &searchCharacterGameDTO{ID: summary.Game.ID, TitleJP: summary.Game.TitleJP, TitleZH: summary.Game.TitleZH, TitleEN: summary.Game.TitleEN}
	}
	return out
}

func toTermDTOs(terms []search.Term) []searchTermDTO {
	out := make([]searchTermDTO, len(terms))
	for i, term := range terms {
		out[i] = searchTermDTO(term)
	}
	return out
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
