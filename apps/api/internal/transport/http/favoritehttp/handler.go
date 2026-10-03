package favoritehttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"favorite"}

type Handler struct {
	service *favorite.Service
	resp    *response.Builder
}

func NewHandler(service *favorite.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "favorite.create", Method: http.MethodPost, Path: "/favorites", Summary: "Create a favorite list", Tags: tags, Access: httpapi.AccessUser}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "favorite.list", Method: http.MethodGet, Path: "/favorites", Summary: "List favorite lists of a user", Tags: tags}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "favorite.addGame", Method: http.MethodPut, Path: "/favorites/{id}", Summary: "Add a game to a favorite list", Tags: tags, Access: httpapi.AccessUser}, h.addGame)
	httpapi.Register(api, httpapi.Route{ID: "favorite.update", Method: http.MethodPatch, Path: "/favorites/{id}", Summary: "Update a favorite list", Tags: tags, Access: httpapi.AccessUser}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "favorite.delete", Method: http.MethodDelete, Path: "/favorites/{id}", Summary: "Delete a favorite list", Tags: tags, Access: httpapi.AccessUser}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "favorite.items", Method: http.MethodGet, Path: "/favorites/{id}/items", Summary: "List games in a favorite list", Tags: tags}, h.items)
	httpapi.Register(api, httpapi.Route{ID: "favorite.removeGame", Method: http.MethodDelete, Path: "/favorites/{id}/games/{game_id}", Summary: "Remove a game from a favorite list", Tags: tags, Access: httpapi.AccessUser}, h.removeGame)
	httpapi.Register(api, httpapi.Route{ID: "favorite.item.update", Method: http.MethodPatch, Path: "/favorites/items/{item_id}", Summary: "Update a favorite item note", Tags: tags, Access: httpapi.AccessUser}, h.updateItem)
	httpapi.Register(api, httpapi.Route{ID: "favorite.item.delete", Method: http.MethodDelete, Path: "/favorites/items/{item_id}", Summary: "Delete a favorite item", Tags: tags, Access: httpapi.AccessUser}, h.deleteItem)
	httpapi.Register(api, httpapi.Route{ID: "favorite.gameStats", Method: http.MethodGet, Path: "/favorites/game/{id}/stats", Summary: "Whether the caller favorited a game", Tags: tags, Access: httpapi.AccessUser}, h.gameStats)
}

func (h *Handler) create(ctx context.Context, in *createFavoriteInput) (*response.Output[favoriteDTO], error) {
	created, err := h.service.Create(ctx, actor.From(ctx), favorite.CreateInput{
		Name:        in.Body.Name,
		Description: in.Body.Description,
		IsPrivate:   in.Body.IsPrivate,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toFavoriteDTO(created)), nil
}

func (h *Handler) list(ctx context.Context, in *listFavoritesInput) (*response.Output[[]favoriteSummaryDTO], error) {
	summaries, err := h.service.List(ctx, actor.From(ctx), favorite.ListQuery{UserID: in.userID(), GameID: in.gameID()})
	if err != nil {
		return nil, err
	}
	out := make([]favoriteSummaryDTO, len(summaries))
	for i, summary := range summaries {
		out[i] = toFavoriteSummaryDTO(summary)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) addGame(ctx context.Context, in *addFavoriteGameInput) (*response.EmptyOutput, error) {
	if err := h.service.AddGame(ctx, actor.From(ctx), in.ID, in.Body.GameID, in.Body.Note); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) update(ctx context.Context, in *updateFavoriteInput) (*response.EmptyOutput, error) {
	changes := favorite.Changes{Name: in.Body.Name, Description: in.Body.Description, IsPrivate: in.Body.IsPrivate}
	if err := h.service.Update(ctx, actor.From(ctx), in.ID, changes); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) delete(ctx context.Context, in *favoritePath) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) items(ctx context.Context, in *favoriteItemsInput) (*response.Output[favoriteItemPageDTO], error) {
	viewer := actor.From(ctx)
	items, total, err := h.service.Items(ctx, viewer, in.ID, favorite.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	page := favoriteItemPageDTO{
		Items: make([]favoriteItemDTO, len(items)),
		Meta: favoriteItemPageMeta{
			PageMeta:     response.NewPageMeta(total, len(items), in.PageSize, in.Page),
			ContentLimit: int(viewer.ContentLimit),
		},
	}
	for i, item := range items {
		page.Items[i] = favoriteItemDTO{ID: item.ID, Note: item.Note, Game: gamehttp.ToGameCard(item.Game)}
	}
	return response.OK(ctx, h.resp, page), nil
}

func (h *Handler) removeGame(ctx context.Context, in *removeFavoriteGameInput) (*response.EmptyOutput, error) {
	if err := h.service.RemoveGame(ctx, actor.From(ctx), in.ID, in.GameID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) updateItem(ctx context.Context, in *updateFavoriteItemInput) (*response.EmptyOutput, error) {
	if err := h.service.UpdateItem(ctx, actor.From(ctx), in.ItemID, in.Body.Note); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) deleteItem(ctx context.Context, in *favoriteItemPath) (*response.EmptyOutput, error) {
	if err := h.service.DeleteItem(ctx, actor.From(ctx), in.ItemID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) gameStats(ctx context.Context, in *favoritePath) (*response.Output[favoriteGameStatsDTO], error) {
	has, err := h.service.HasGame(ctx, actor.From(ctx), in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, favoriteGameStatsDTO{IsFavorite: has}), nil
}
