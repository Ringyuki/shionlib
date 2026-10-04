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
	ID      int    `json:"id"`
	TitleJP string `json:"title_jp"`
	TitleZH string `json:"title_zh"`
	TitleEN string `json:"title_en"`
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
