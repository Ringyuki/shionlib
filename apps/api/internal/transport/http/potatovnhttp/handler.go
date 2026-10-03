package potatovnhttp

import (
	"context"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"potatovn"}

type bindPotatoVNInput struct {
	Body struct {
		PVNUserName string `json:"pvn_user_name" minLength:"1" maxLength:"255"`
		PVNPassword string `json:"pvn_password" minLength:"1"`
	}
}

type potatoVNGamePath struct {
	GameID int `path:"gameId" minimum:"1"`
}

type potatoVNBindingDTO struct {
	PVNUserID       int       `json:"pvn_user_id"`
	PVNUserName     string    `json:"pvn_user_name"`
	PVNUserAvatar   *string   `json:"pvn_user_avatar"`
	PVNTokenExpires time.Time `json:"pvn_token_expires"`
	Created         time.Time `json:"created"`
	Updated         time.Time `json:"updated"`
}

type potatoVNGameDataDTO struct {
	PVNGalgameID  int        `json:"pvn_galgame_id"`
	TotalPlayTime int        `json:"total_play_time"`
	LastPlayDate  *time.Time `json:"last_play_date"`
	PlayType      int        `json:"play_type"`
	MyRate        int        `json:"my_rate"`
	SyncedAt      time.Time  `json:"synced_at"`
}

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

func (h *Handler) gameData(ctx context.Context, in *potatoVNGamePath) (*response.Output[potatoVNGameDataDTO], error) {
	mapping, err := h.service.GameData(ctx, actor.From(ctx), in.GameID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toGameDataDTO(mapping)), nil
}

func (h *Handler) addGame(ctx context.Context, in *potatoVNGamePath) (*response.Output[potatoVNGameDataDTO], error) {
	mapping, err := h.service.AddGame(ctx, actor.From(ctx), in.GameID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toGameDataDTO(mapping)), nil
}

func (h *Handler) removeGame(ctx context.Context, in *potatoVNGamePath) (*response.EmptyOutput, error) {
	if err := h.service.RemoveGame(ctx, actor.From(ctx), in.GameID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func toBindingDTO(binding potatovn.Binding) potatoVNBindingDTO {
	return potatoVNBindingDTO{
		PVNUserID:       binding.PVNUserID,
		PVNUserName:     binding.PVNUserName,
		PVNUserAvatar:   binding.PVNUserAvatar,
		PVNTokenExpires: binding.TokenExpires,
		Created:         binding.Created,
		Updated:         binding.Updated,
	}
}

func toGameDataDTO(mapping potatovn.Mapping) potatoVNGameDataDTO {
	return potatoVNGameDataDTO{
		PVNGalgameID:  mapping.PVNGalgameID,
		TotalPlayTime: mapping.TotalPlayTime,
		LastPlayDate:  mapping.LastPlayDate,
		PlayType:      mapping.PlayType,
		MyRate:        mapping.MyRate,
		SyncedAt:      mapping.SyncedAt,
	}
}
