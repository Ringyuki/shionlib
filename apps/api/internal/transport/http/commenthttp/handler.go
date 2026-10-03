package commenthttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"comment"}

type Handler struct {
	service *comment.Service
	resp    *response.Builder
}

func NewHandler(service *comment.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "comment.create", Method: http.MethodPost, Path: "/comment/game/{game_id}", Summary: "Comment on a game", Tags: tags, Access: httpapi.AccessUser}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "comment.listByGame", Method: http.MethodGet, Path: "/comment/game/{game_id}", Summary: "List comments of a game", Tags: tags}, h.listByGame)
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

func (h *Handler) raw(ctx context.Context, in *commentPath) (*response.Output[commentRawDTO], error) {
	found, err := h.service.Raw(ctx, actor.From(ctx), in.CommentID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, commentRawDTO{ID: found.ID, Content: found.Content, CreatorID: found.CreatorID}), nil
}

func (h *Handler) delete(ctx context.Context, in *commentPath) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, actor.From(ctx), in.CommentID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) like(ctx context.Context, in *commentPath) (*response.EmptyOutput, error) {
	if err := h.service.ToggleLike(ctx, actor.From(ctx), in.CommentID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) listByGame(ctx context.Context, in *gameCommentsInput) (*response.Output[response.Page[commentItemDTO]], error) {
	entries, total, err := h.service.ListByGame(ctx, actor.From(ctx), in.GameID, comment.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := response.MapPage(entries, total, in.PageSize, in.Page, func(entry comment.Entry) commentItemDTO {
		return toItem(entry, now)
	})
	return response.OK(ctx, h.resp, page), nil
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
		Meta: userCommentPageMeta{
			PageMeta:      response.NewPageMeta(total, len(entries), in.PageSize, in.Page),
			IsCurrentUser: in.ID == viewer.UserID,
		},
	}
	for i, entry := range entries {
		page.Items[i] = toUserComment(entry, now)
	}
	return response.OK(ctx, h.resp, page), nil
}
