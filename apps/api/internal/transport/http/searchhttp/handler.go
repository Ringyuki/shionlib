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
		items[i] = searchGameItemDTO{GameListItemDTO: gamehttp.ToGameListItem(item.Card), Formatted: toHighlightDTO(item.Highlight)}
	}
	meta := response.NewPageMeta(page.Total, len(items), in.PageSize, in.Page)
	meta.TotalPages = page.TotalPages
	return response.OK(ctx, h.resp, searchGamePageDTO{Items: items, Meta: searchGamePageMetaDTO{PageMeta: meta, ContentLimit: int(viewer.ContentLimit)}}), nil
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
