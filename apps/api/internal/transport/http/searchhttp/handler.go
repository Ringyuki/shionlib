package searchhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"search"}

type searchGamesInput struct {
	httpapi.PageQuery
	Q   string `query:"q" doc:"Keyword matched against titles, aliases, tags and developers"`
	Tag string `query:"tag" doc:"Exact tag name"`
}

type searchTagsInput struct {
	Q     string `query:"q" doc:"Matches tag names and aliases"`
	Limit int    `query:"limit" default:"10" minimum:"0" maximum:"100"`
}

type searchTrendingInput struct {
	Limit  int    `query:"limit" default:"10" minimum:"1" maximum:"50"`
	Window string `query:"window" enum:"1h,6h,1d" doc:"Single trend window; all windows are summed when omitted"`
}

type searchSuggestInput struct {
	Prefix string `query:"prefix" required:"true" minLength:"1"`
	Limit  int    `query:"limit" default:"10" minimum:"1" maximum:"50"`
}

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
	gamehttp.GameListItem
	Formatted *searchHighlightDTO `json:"_formatted,omitempty" doc:"Highlighted fields when the search engine provides them"`
}

type searchGamePageMeta struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type searchGamePageDTO struct {
	Items []searchGameItemDTO `json:"items"`
	Meta  searchGamePageMeta  `json:"meta"`
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

type Handler struct {
	service *search.Service
	resp    *response.Builder
}

func NewHandler(service *search.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "search.games", Method: http.MethodGet, Path: "/search/games", Summary: "Search games", Tags: tags}, h.games)
	httpapi.Register(api, httpapi.Route{ID: "search.tags", Method: http.MethodGet, Path: "/search/tags", Summary: "Search tags", Tags: tags}, h.tags)
	httpapi.Register(api, httpapi.Route{ID: "search.trending", Method: http.MethodGet, Path: "/search/trending", Summary: "Trending search queries", Tags: tags}, h.trending)
	httpapi.Register(api, httpapi.Route{ID: "search.suggest", Method: http.MethodGet, Path: "/search/suggest", Summary: "Suggest search queries for a prefix", Tags: tags}, h.suggest)
}

func (h *Handler) games(ctx context.Context, in *searchGamesInput) (*response.Output[searchGamePageDTO], error) {
	viewer := actor.From(ctx)
	page, err := h.service.Games(ctx, viewer, search.Query{Q: in.Q, Tag: in.Tag, Page: search.Page{Number: in.Page, Size: in.PageSize}})
	if err != nil {
		return nil, err
	}
	items := make([]searchGameItemDTO, len(page.Items))
	for i, item := range page.Items {
		items[i] = searchGameItemDTO{GameListItem: gamehttp.ToGameListItem(item.Card), Formatted: toHighlightDTO(item.Highlight)}
	}
	meta := response.NewPageMeta(page.Total, len(items), in.PageSize, in.Page)
	meta.TotalPages = page.TotalPages
	return response.OK(ctx, h.resp, searchGamePageDTO{Items: items, Meta: searchGamePageMeta{PageMeta: meta, ContentLimit: int(viewer.ContentLimit)}}), nil
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

func (h *Handler) tags(ctx context.Context, in *searchTagsInput) (*response.Output[[]searchTagDTO], error) {
	matches, err := h.service.Tags(ctx, in.Q, in.Limit)
	if err != nil {
		return nil, err
	}
	out := make([]searchTagDTO, len(matches))
	for i, match := range matches {
		aliases := match.Aliases
		if aliases == nil {
			aliases = []string{}
		}
		out[i] = searchTagDTO{ID: match.ID, Name: match.Name, Count: match.Count, Aliases: aliases, DisplayName: match.DisplayName}
	}
	return response.OK(ctx, h.resp, out), nil
}

func toTermDTOs(terms []search.Term) []searchTermDTO {
	out := make([]searchTermDTO, len(terms))
	for i, term := range terms {
		out[i] = searchTermDTO(term)
	}
	return out
}

func (h *Handler) trending(ctx context.Context, in *searchTrendingInput) (*response.Output[[]searchTermDTO], error) {
	var window *search.Window
	if in.Window != "" {
		selected := search.Window(in.Window)
		window = &selected
	}
	terms, err := h.service.Trending(ctx, in.Limit, window)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toTermDTOs(terms)), nil
}

func (h *Handler) suggest(ctx context.Context, in *searchSuggestInput) (*response.Output[[]searchTermDTO], error) {
	terms, err := h.service.Suggest(ctx, in.Prefix, in.Limit)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toTermDTOs(terms)), nil
}
