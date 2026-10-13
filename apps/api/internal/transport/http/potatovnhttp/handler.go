package potatovnhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"potatovn"}

type Handler struct {
	service *potatovn.Service
	resp    *response.Builder
}

func NewHandler(service *potatovn.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "potatovn.binding.get", Method: http.MethodGet, Path: "/potatovn/binding", Summary: "Get the caller's PotatoVN binding", Tags: tags, Access: httpapi.AccessUser}, h.binding)
	httpapi.Register(api, httpapi.Route{ID: "potatovn.binding.create", Method: http.MethodPost, Path: "/potatovn/binding", Summary: "Bind a PotatoVN account", Tags: tags, Access: httpapi.AccessUser, Throttle: "auth"}, h.bind)
	httpapi.Register(api, httpapi.Route{ID: "potatovn.binding.delete", Method: http.MethodDelete, Path: "/potatovn/binding", Summary: "Unbind the PotatoVN account", Tags: tags, Access: httpapi.AccessUser}, h.unbind)
	httpapi.Register(api, httpapi.Route{ID: "potatovn.game.get", Method: http.MethodGet, Path: "/potatovn/game/{gameId}", Summary: "PotatoVN play data for a game", Tags: tags, Access: httpapi.AccessUser}, h.gameData)
	httpapi.Register(api, httpapi.Route{ID: "potatovn.game.add", Method: http.MethodPost, Path: "/potatovn/game/{gameId}", Summary: "Add a game to the PotatoVN library", Tags: tags, Access: httpapi.AccessUser}, h.addGame)
	httpapi.Register(api, httpapi.Route{ID: "potatovn.game.remove", Method: http.MethodDelete, Path: "/potatovn/game/{gameId}", Summary: "Remove a game from the PotatoVN library", Tags: tags, Access: httpapi.AccessUser}, h.removeGame)
}

func (h *Handler) binding(ctx context.Context, _ *struct{}) (*response.Output[potatoVNBindingDTO], error) {
	binding, err := h.service.Binding(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toBindingDTO(binding)), nil
}

func (h *Handler) bind(ctx context.Context, in *bindPotatoVNInput) (*response.Output[potatoVNBindingDTO], error) {
	binding, err := h.service.Bind(ctx, actor.From(ctx), in.Body.PVNUserName, in.Body.PVNPassword)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toBindingDTO(binding)), nil
}

func (h *Handler) unbind(ctx context.Context, _ *struct{}) (*response.EmptyOutput, error) {
	if err := h.service.Unbind(ctx, actor.From(ctx)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) gameData(ctx context.Context, in *potatoVNGamePathInput) (*response.Output[potatoVNGameDataDTO], error) {
	mapping, err := h.service.GameData(ctx, actor.From(ctx), in.GameID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toGameDataDTO(mapping)), nil
}

func (h *Handler) addGame(ctx context.Context, in *potatoVNGamePathInput) (*response.Output[potatoVNGameDataDTO], error) {
	mapping, err := h.service.AddGame(ctx, actor.From(ctx), in.GameID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toGameDataDTO(mapping)), nil
}

func (h *Handler) removeGame(ctx context.Context, in *potatoVNGamePathInput) (*response.EmptyOutput, error) {
	if err := h.service.RemoveGame(ctx, actor.From(ctx), in.GameID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
