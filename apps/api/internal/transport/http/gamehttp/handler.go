package gamehttp

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var (
	tags        = []string{"game"}
	bangumiTags = []string{"bangumi"}
)

type Handler struct {
	service *game.Service
	scores  *game.ScoreService
	resp    *response.Builder
}

func NewHandler(service *game.Service, scores *game.ScoreService, resp *response.Builder) *Handler {
	return &Handler{service: service, scores: scores, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "game.list", Method: http.MethodGet, Path: "/game/list", Summary: "List games with filters", Tags: tags}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "game.random", Method: http.MethodGet, Path: "/game/random", Summary: "Pick a random visible game id", Tags: tags}, h.random)
	httpapi.Register(api, httpapi.Route{ID: "game.recentUpdate", Method: http.MethodGet, Path: "/game/recent-update", Summary: "List recently updated games", Tags: tags}, h.recentUpdate)
	httpapi.Register(api, httpapi.Route{ID: "game.get", Method: http.MethodGet, Path: "/game/{id}", Summary: "Get a game", Tags: tags}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "game.header", Method: http.MethodGet, Path: "/game/{id}/header", Summary: "Get the header block of a game page", Tags: tags}, h.header)
	httpapi.Register(api, httpapi.Route{ID: "game.details", Method: http.MethodGet, Path: "/game/{id}/details", Summary: "Get the details block of a game page", Tags: tags}, h.details)
	httpapi.Register(api, httpapi.Route{ID: "game.characters", Method: http.MethodGet, Path: "/game/{id}/characters", Summary: "List the characters of a game", Tags: tags}, h.characters)
	httpapi.Register(api, httpapi.Route{ID: "game.view", Method: http.MethodPost, Path: "/game/{id}/view", Summary: "Count a page view", Tags: tags}, h.view)
	httpapi.Register(api, httpapi.Route{ID: "game.bangumiScore", Method: http.MethodGet, Path: "/game/score/bangumi/{id}", Summary: "Get the Bangumi rating of a game", Tags: tags}, h.bangumiScore)
	httpapi.Register(api, httpapi.Route{ID: "game.vndbScore", Method: http.MethodGet, Path: "/game/score/vndb/{id}", Summary: "Get the VNDB rating of a game", Tags: tags}, h.vndbScore)
	httpapi.Register(api, httpapi.Route{ID: "bangumi.get", Method: http.MethodGet, Path: "/bangumi/get", Summary: "Read a Bangumi resource", Tags: bangumiTags}, h.bangumiResource)
}

func (h *Handler) list(ctx context.Context, in *listGamesInput) (*response.Output[gameListPageDTO], error) {
	viewer := actor.From(ctx)
	cards, total, err := h.service.List(ctx, viewer, in.query())
	if err != nil {
		return nil, err
	}
	items := ToGameListItems(cards)
	return response.OK(ctx, h.resp, gameListPageDTO{
		Items: items,
		Meta: gameListPageMeta{
			PageMeta:     response.NewPageMeta(total, len(items), in.PageSize, in.Page),
			ContentLimit: int(viewer.ContentLimit),
		},
	}), nil
}

func (h *Handler) random(ctx context.Context, _ *struct{}) (*response.Output[randomGameID], error) {
	id, found, err := h.service.Random(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	if !found {
		return response.OK[randomGameID](ctx, h.resp, nil), nil
	}
	return response.OK[randomGameID](ctx, h.resp, &id), nil
}

func (h *Handler) recentUpdate(ctx context.Context, in *gameRecentUpdateInput) (*response.Output[response.Page[GameListItem]], error) {
	cards, total, err := h.service.RecentUpdates(ctx, actor.From(ctx), game.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.NewPage(ToGameListItems(cards), total, in.PageSize, in.Page)), nil
}

func (h *Handler) get(ctx context.Context, in *gamePath) (*response.Output[gameDetailDTO], error) {
	viewer := actor.From(ctx)
	detail, err := h.service.Get(ctx, viewer, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDetailDTO(detail, int(viewer.ContentLimit))), nil
}

func (h *Handler) header(ctx context.Context, in *gamePath) (*response.Output[gameHeaderDTO], error) {
	viewer := actor.From(ctx)
	detail, err := h.service.Header(ctx, viewer, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toHeaderDTO(detail, int(viewer.ContentLimit))), nil
}

func (h *Handler) details(ctx context.Context, in *gamePath) (*response.Output[gameDetailsDTO], error) {
	viewer := actor.From(ctx)
	detail, err := h.service.Details(ctx, viewer, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDetailsDTO(detail, int(viewer.ContentLimit))), nil
}

func (h *Handler) characters(ctx context.Context, in *gamePath) (*response.Output[gameCharactersDTO], error) {
	viewer := actor.From(ctx)
	credits, err := h.service.Characters(ctx, viewer, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, gameCharactersDTO{Characters: mapSlice(credits, toCharacterCreditDTO), ContentLimit: int(viewer.ContentLimit)}), nil
}

func (h *Handler) view(ctx context.Context, in *gamePath) (*response.EmptyOutput, error) {
	if err := h.service.IncreaseViews(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) bangumiScore(ctx context.Context, in *gamePath) (*response.Output[*bangumiScoreDTO], error) {
	score, err := h.scores.Bangumi(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toBangumiScoreDTO(score)), nil
}

func (h *Handler) vndbScore(ctx context.Context, in *gamePath) (*response.Output[*vndbScoreDTO], error) {
	score, err := h.scores.VNDB(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toVNDBScoreDTO(score)), nil
}

func (h *Handler) bangumiResource(ctx context.Context, in *bangumiResourceInput) (*response.Output[json.RawMessage], error) {
	raw, err := h.scores.BangumiResource(ctx, game.BangumiResourceQuery{Kind: in.Path, ID: in.ID, Relation: in.Type})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, json.RawMessage(raw)), nil
}
