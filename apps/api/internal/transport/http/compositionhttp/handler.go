package compositionhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"composition"}

type Handler struct {
	service *composition.Service
	resp    *response.Builder
}

func NewHandler(service *composition.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	user := httpapi.AccessUser
	httpapi.Register(api, httpapi.Route{ID: "composition.bases", Method: http.MethodGet, Path: "/game/{gameId}/composition/bases", Summary: "List the resources of a game with whether a patch can be composed onto each", Tags: tags, Access: user}, h.bases)
	httpapi.Register(api, httpapi.Route{ID: "composition.begin", Method: http.MethodPost, Path: "/game/{gameId}/composition", Summary: "Begin composing a new resource from a base of the game", Tags: tags, Access: user}, h.begin)
	httpapi.Register(api, httpapi.Route{ID: "composition.mine", Method: http.MethodGet, Path: "/composition/mine", Summary: "List the caller's compositions that wait, run or failed", Tags: tags, Access: user}, h.mine)
	httpapi.Register(api, httpapi.Route{ID: "composition.get", Method: http.MethodGet, Path: "/composition/{id}", Summary: "Show a composition with its plan and progress", Tags: tags, Access: user}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "composition.edit", Method: http.MethodPatch, Path: "/composition/{id}", Summary: "Describe the result of a composition and choose where the patch goes", Tags: tags, Access: user}, h.edit)
	httpapi.Register(api, httpapi.Route{ID: "composition.attachPatch", Method: http.MethodPut, Path: "/composition/{id}/patch", Summary: "Give a composition its patch from a completed upload", Tags: tags, Access: user}, h.attachPatch)
	httpapi.Register(api, httpapi.Route{ID: "composition.detachPatch", Method: http.MethodDelete, Path: "/composition/{id}/patch", Summary: "Take the patch out of a composition", Tags: tags, Access: user}, h.detachPatch)
	httpapi.Register(api, httpapi.Route{ID: "composition.attachSave", Method: http.MethodPut, Path: "/composition/{id}/save", Summary: "Give a composition saved games to pack beside the game", Tags: tags, Access: user}, h.attachSave)
	httpapi.Register(api, httpapi.Route{ID: "composition.detachSave", Method: http.MethodDelete, Path: "/composition/{id}/save", Summary: "Take the saved games out of a composition", Tags: tags, Access: user}, h.detachSave)
	httpapi.Register(api, httpapi.Route{ID: "composition.start", Method: http.MethodPost, Path: "/composition/{id}/start", Summary: "Create the resource of a composition and queue its work", Tags: tags, Access: user}, h.start)
	httpapi.Register(api, httpapi.Route{ID: "composition.retry", Method: http.MethodPost, Path: "/composition/{id}/retry", Summary: "Queue a failed composition again", Tags: tags, Access: user}, h.retry)
	httpapi.Register(api, httpapi.Route{ID: "composition.discard", Method: http.MethodDelete, Path: "/composition/{id}", Summary: "Discard a composition that has not started or has failed", Tags: tags, Access: user}, h.discard)
	httpapi.Register(api, httpapi.Route{ID: "composition.lineage", Method: http.MethodGet, Path: "/game/download-source/{resourceId}/composition", Summary: "Show what a resource was composed from and, to its owner, the composition under way", Tags: tags}, h.lineage)
	httpapi.Register(api, httpapi.Route{ID: "composition.rebuild", Method: http.MethodPost, Path: "/game/download-source/{resourceId}/composition", Summary: "Compose a resource again with a new patch", Tags: tags, Access: user}, h.rebuild)
}

func (h *Handler) shown(ctx context.Context, view composition.View, err error) (*response.Output[compositionDTO], error) {
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toCompositionDTO(view)), nil
}

func (h *Handler) bases(ctx context.Context, in *compositionGameInput) (*response.Output[[]compositionBaseDTO], error) {
	candidates, err := h.service.Candidates(ctx, actor.From(ctx), in.GameID)
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	bases := make([]compositionBaseDTO, len(candidates))
	for i, candidate := range candidates {
		bases[i] = toBaseDTO(candidate, now)
	}
	return response.OK(ctx, h.resp, bases), nil
}

func (h *Handler) begin(ctx context.Context, in *beginCompositionInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Begin(ctx, actor.From(ctx), in.GameID, in.Body.BaseResourceID)
	return h.shown(ctx, view, err)
}

func (h *Handler) mine(ctx context.Context, _ *struct{}) (*response.Output[[]compositionDTO], error) {
	views, err := h.service.Active(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	dtos := make([]compositionDTO, len(views))
	for i, view := range views {
		dtos[i] = toCompositionDTO(view)
	}
	return response.OK(ctx, h.resp, dtos), nil
}

func (h *Handler) get(ctx context.Context, in *compositionPathInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Get(ctx, actor.From(ctx), in.ID)
	return h.shown(ctx, view, err)
}

func (h *Handler) edit(ctx context.Context, in *editCompositionInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Edit(ctx, actor.From(ctx), in.ID, in.changes())
	return h.shown(ctx, view, err)
}

func (h *Handler) attachPatch(ctx context.Context, in *attachCompositionInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Attach(ctx, actor.From(ctx), in.ID, composition.RolePatch, in.Body.upload())
	return h.shown(ctx, view, err)
}

func (h *Handler) detachPatch(ctx context.Context, in *compositionPathInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Detach(ctx, actor.From(ctx), in.ID, composition.RolePatch)
	return h.shown(ctx, view, err)
}

func (h *Handler) attachSave(ctx context.Context, in *attachCompositionInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Attach(ctx, actor.From(ctx), in.ID, composition.RoleSave, in.Body.upload())
	return h.shown(ctx, view, err)
}

func (h *Handler) detachSave(ctx context.Context, in *compositionPathInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Detach(ctx, actor.From(ctx), in.ID, composition.RoleSave)
	return h.shown(ctx, view, err)
}

func (h *Handler) start(ctx context.Context, in *compositionPathInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Start(ctx, actor.From(ctx), in.ID)
	return h.shown(ctx, view, err)
}

func (h *Handler) retry(ctx context.Context, in *compositionPathInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Retry(ctx, actor.From(ctx), in.ID)
	return h.shown(ctx, view, err)
}

func (h *Handler) discard(ctx context.Context, in *compositionPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Discard(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) lineage(ctx context.Context, in *compositionResourceInput) (*response.Output[compositionLineageDTO], error) {
	lineage, err := h.service.Lineage(ctx, actor.From(ctx), in.ResourceID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toLineageDTO(lineage)), nil
}

func (h *Handler) rebuild(ctx context.Context, in *rebuildCompositionInput) (*response.Output[compositionDTO], error) {
	view, err := h.service.Rebuild(ctx, actor.From(ctx), in.ResourceID, composition.RebuildInput{
		Upload:       composition.Upload{SessionID: in.Body.UploadSessionID, Name: in.Body.FileName},
		PatchVersion: in.Body.PatchVersion,
		Note:         in.Body.Note,
	})
	return h.shown(ctx, view, err)
}
