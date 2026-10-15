package walkthroughhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type FormatHandler struct {
	formats *walkthrough.FormatService
	resp    *response.Builder
}

func NewFormatHandler(formats *walkthrough.FormatService, resp *response.Builder) *FormatHandler {
	return &FormatHandler{formats: formats, resp: resp}
}

func (h *FormatHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.formatter", Method: http.MethodGet, Path: "/walkthrough/format", Summary: "Whether the caller can have walkthrough text formatted", Tags: tags, Access: httpapi.AccessUser}, h.formatter)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.format", Method: http.MethodPost, Path: "/walkthrough/game/{id}/format", Summary: "Start formatting walkthrough text into a note and routes; the result is fetched by the task id", Tags: tags, Access: httpapi.AccessUser}, h.format)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.formatResult", Method: http.MethodGet, Path: "/walkthrough/format/{task}", Summary: "Get a formatting task the caller started, with its result once done", Tags: tags, Access: httpapi.AccessUser}, h.result)
}

func (h *FormatHandler) formatter(ctx context.Context, _ *struct{}) (*response.Output[walkthroughFormatterDTO], error) {
	available, err := h.formats.Available(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, walkthroughFormatterDTO{Available: available}), nil
}

func (h *FormatHandler) format(ctx context.Context, in *formatWalkthroughInput) (*response.Output[walkthroughFormatTaskDTO], error) {
	task, err := h.formats.Start(ctx, actor.From(ctx), in.ID, in.Body.Text)
	if err != nil {
		return nil, err
	}
	return h.task(ctx, task)
}

func (h *FormatHandler) result(ctx context.Context, in *formatTaskInput) (*response.Output[walkthroughFormatTaskDTO], error) {
	task, err := h.formats.Result(ctx, actor.From(ctx), in.Task)
	if err != nil {
		return nil, err
	}
	return h.task(ctx, task)
}

func (h *FormatHandler) task(ctx context.Context, task walkthrough.FormatTask) (*response.Output[walkthroughFormatTaskDTO], error) {
	dto, err := toFormatTask(task)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, dto), nil
}
