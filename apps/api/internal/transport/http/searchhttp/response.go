package searchhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type searchHighlightDTO struct {
	TitleJP *string  `json:"title_jp,omitempty"`
	TitleZH *string  `json:"title_zh,omitempty"`
	TitleEN *string  `json:"title_en,omitempty"`
	Aliases []string `json:"aliases,omitempty"`
	IntroJP *string  `json:"intro_jp,omitempty"`
	IntroZH *string  `json:"intro_zh,omitempty"`
	IntroEN *string  `json:"intro_en,omitempty"`
}

type searchGameItemDTO struct {
	gamehttp.GameListItemDTO
	Formatted *searchHighlightDTO `json:"_formatted,omitempty" doc:"Highlighted fields when the search engine provides them"`
}

type searchGamePageMetaDTO struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type searchGamePageDTO struct {
	Items []searchGameItemDTO   `json:"items"`
	Meta  searchGamePageMetaDTO `json:"meta"`
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

func toHighlightDTO(highlight *search.Highlight) *searchHighlightDTO {
	if highlight == nil {
		return nil
	}
	return &searchHighlightDTO{
		TitleJP: highlight.TitleJP, TitleZH: highlight.TitleZH, TitleEN: highlight.TitleEN, Aliases: highlight.Aliases,
		IntroJP: highlight.IntroJP, IntroZH: highlight.IntroZH, IntroEN: highlight.IntroEN,
	}
}

func toTermDTOs(terms []search.Term) []searchTermDTO {
	out := make([]searchTermDTO, len(terms))
	for i, term := range terms {
		out[i] = searchTermDTO(term)
	}
	return out
}
