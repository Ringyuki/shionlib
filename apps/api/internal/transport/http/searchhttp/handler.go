package searchhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const Throttle = "search"

var (
	tags    = []string{"search"}
	tagTags = []string{"tags"}
)

type Handler struct {
	service *search.Service
	resp    *response.Builder
}

func NewHandler(service *search.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "search.query", Method: http.MethodGet, Path: "/search", Summary: "Search games, developers and characters", Tags: tags, Throttle: Throttle}, h.search)
	httpapi.Register(api, httpapi.Route{ID: "search.record", Method: http.MethodPost, Path: "/search/record", Summary: "Count a settled search keyword towards the trends", Tags: tags, Throttle: Throttle}, h.record)
	httpapi.Register(api, httpapi.Route{ID: "search.trending", Method: http.MethodGet, Path: "/search/trending", Summary: "Trending search keywords", Tags: tags}, h.trending)
	httpapi.Register(api, httpapi.Route{ID: "search.suggest", Method: http.MethodGet, Path: "/search/suggest", Summary: "Suggest game titles for a prefix", Tags: tags}, h.suggest)
	httpapi.Register(api, httpapi.Route{ID: "tag.search", Method: http.MethodGet, Path: "/tags", Summary: "Search tags", Tags: tagTags}, h.tags)
}

func (h *Handler) search(ctx context.Context, in *searchInput) (*response.Output[searchResultsDTO], error) {
	kinds := []catalog.Entity{catalog.EntityGame}
	if len(in.Types) > 0 {
		kinds = make([]catalog.Entity, len(in.Types))
		for i, kind := range in.Types {
			kinds[i] = catalog.Entity(kind)
		}
	}
	results, err := h.service.Search(ctx, actor.From(ctx), search.Query{Q: in.Q, Kinds: kinds, Page: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toResultsDTO(results)), nil
}

func (h *Handler) record(ctx context.Context, in *searchRecordInput) (*response.EmptyOutput, error) {
	if err := h.service.Record(ctx, in.Body.Q); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) tags(ctx context.Context, in *tagSearchInput) (*response.Output[[]searchTagDTO], error) {
	matches, err := h.service.Tags(ctx, in.Q, in.Limit)
	if err != nil {
		return nil, err
	}
	out := make([]searchTagDTO, len(matches))
	for i, match := range matches {
		out[i] = searchTagDTO{ID: match.ID, Name: match.Name, Count: match.Count, Aliases: nonNil(match.Aliases), DisplayName: match.DisplayName}
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

func (h *Handler) suggest(ctx context.Context, in *searchSuggestInput) (*response.Output[[]string], error) {
	titles, err := h.service.Suggest(ctx, actor.From(ctx), in.Prefix, in.Limit)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, titles), nil
}
