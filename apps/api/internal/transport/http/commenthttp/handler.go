package commenthttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
)

var tags = []string{"comment"}

type Handler struct {
	service *comment.Service
	pins    *comment.PinService
	resp    *response.Builder
}

func NewHandler(service *comment.Service, pins *comment.PinService, resp *response.Builder) *Handler {
	return &Handler{service: service, pins: pins, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "comment.create", Method: http.MethodPost, Path: "/comment/game/{game_id}", Summary: "Comment on a game", Tags: tags, Access: httpapi.AccessUser}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "comment.listByGame", Method: http.MethodGet, Path: "/comment/game/{game_id}", Summary: "List the comment threads of a game", Tags: tags}, h.listByGame)
	httpapi.Register(api, httpapi.Route{ID: "comment.createOnResource", Method: http.MethodPost, Path: "/comment/resource/{resource_id}", Summary: "Comment on a download resource", Tags: tags, Access: httpapi.AccessUser}, h.createOnResource)
	httpapi.Register(api, httpapi.Route{ID: "comment.listByResource", Method: http.MethodGet, Path: "/comment/resource/{resource_id}", Summary: "List the comment threads of a download resource, the pinned one first", Tags: tags}, h.listByResource)
	httpapi.Register(api, httpapi.Route{ID: "comment.pin", Method: http.MethodPut, Path: "/comment/{comment_id}/pin", Summary: "Pin a comment on a download resource, replacing the pinned one", Tags: tags, Access: httpapi.AccessUser}, h.pin)
	httpapi.Register(api, httpapi.Route{ID: "comment.unpin", Method: http.MethodDelete, Path: "/comment/{comment_id}/pin", Summary: "Unpin a comment on a download resource", Tags: tags, Access: httpapi.AccessUser}, h.unpin)
	httpapi.Register(api, httpapi.Route{ID: "comment.edit", Method: http.MethodPatch, Path: "/comment/{comment_id}", Summary: "Edit a comment", Tags: tags, Access: httpapi.AccessUser}, h.edit)
	httpapi.Register(api, httpapi.Route{ID: "comment.raw", Method: http.MethodGet, Path: "/comment/{comment_id}/raw", Summary: "Editor state of a comment", Tags: tags, Access: httpapi.AccessUser}, h.raw)
	httpapi.Register(api, httpapi.Route{ID: "comment.delete", Method: http.MethodDelete, Path: "/comment/{comment_id}", Summary: "Delete a comment", Tags: tags, Access: httpapi.AccessUser}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "comment.like", Method: http.MethodPost, Path: "/comment/{comment_id}/like", Summary: "Toggle a like on a comment", Tags: tags, Access: httpapi.AccessUser}, h.like)
	httpapi.Register(api, httpapi.Route{ID: "comment.listByUser", Method: http.MethodGet, Path: "/user/datas/{id}/comments", Summary: "List visible comments of a user", Tags: tags}, h.listByUser)
}

func (h *Handler) create(ctx context.Context, in *createCommentInput) (*response.Output[commentCreatedDTO], error) {
	created, err := h.service.Create(ctx, actor.From(ctx), in.GameID, comment.CreateInput{Content: in.document, ParentID: in.Body.ParentID})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toCreated(created, h.resp.Now())), nil
}

func (h *Handler) edit(ctx context.Context, in *editCommentInput) (*response.Output[commentEditedDTO], error) {
	edited, err := h.service.Edit(ctx, actor.From(ctx), in.CommentID, in.document)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toEdited(edited, h.resp.Now())), nil
}

func (h *Handler) raw(ctx context.Context, in *commentPathInput) (*response.Output[commentRawDTO], error) {
	found, err := h.service.Raw(ctx, actor.From(ctx), in.CommentID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, commentRawDTO{ID: found.ID, Content: richtexthttp.Content(found.Content), CreatorID: found.CreatorID}), nil
}

func (h *Handler) delete(ctx context.Context, in *commentPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, actor.From(ctx), in.CommentID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) like(ctx context.Context, in *commentPathInput) (*response.EmptyOutput, error) {
	if err := h.service.ToggleLike(ctx, actor.From(ctx), in.CommentID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) createOnResource(ctx context.Context, in *createResourceCommentInput) (*response.Output[commentCreatedDTO], error) {
	created, err := h.service.CreateOnResource(ctx, actor.From(ctx), in.ResourceID, comment.CreateInput{Content: in.document, ParentID: in.Body.ParentID})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toCreated(created, h.resp.Now())), nil
}

func (h *Handler) pin(ctx context.Context, in *commentPathInput) (*response.EmptyOutput, error) {
	if err := h.pins.Pin(ctx, actor.From(ctx), in.CommentID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) unpin(ctx context.Context, in *commentPathInput) (*response.EmptyOutput, error) {
	if err := h.pins.Unpin(ctx, actor.From(ctx), in.CommentID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) listByGame(ctx context.Context, in *gameCommentsInput) (*response.Output[commentThreadPageDTO], error) {
	list, err := h.service.ListByGame(ctx, actor.From(ctx), comment.ThreadQuery{
		Subject: comment.Subject{GameID: in.GameID},
		Order:   comment.Order(in.Order),
		Page:    comment.Page{Number: in.Page, Size: in.PageSize},
		Focus:   in.Focus,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toThreadPage(list, in.PageSize, h.resp.Now())), nil
}

func (h *Handler) listByResource(ctx context.Context, in *resourceCommentsInput) (*response.Output[commentThreadPageDTO], error) {
	list, err := h.service.ListByResource(ctx, actor.From(ctx), in.ResourceID, comment.ThreadQuery{
		Order: comment.Order(in.Order),
		Page:  comment.Page{Number: in.Page, Size: in.PageSize},
		Focus: in.Focus,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toThreadPage(list, in.PageSize, h.resp.Now())), nil
}

func (h *Handler) listByUser(ctx context.Context, in *userCommentsInput) (*response.Output[userCommentPageDTO], error) {
	viewer := actor.From(ctx)
	entries, total, err := h.service.ListByCreator(ctx, viewer, in.ID, comment.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := userCommentPageDTO{
		Items: make([]userCommentDTO, len(entries)),
		Meta: userCommentPageMetaDTO{
			PageMeta:      response.NewPageMeta(total, len(entries), in.PageSize, in.Page),
			IsCurrentUser: in.ID == viewer.UserID,
		},
	}
	for i, entry := range entries {
		page.Items[i] = toUserComment(entry, now)
	}
	return response.OK(ctx, h.resp, page), nil
}
