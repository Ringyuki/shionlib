package uploadhttp

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

func (h *Handler) reportFailure(ctx context.Context, in *reportFailureInput) (*response.Output[uploadFailureDTO], error) {
	id, err := h.service.ReportFailure(ctx, actor.From(ctx), in.report(clientinfo.From(ctx)))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, uploadFailureDTO{ID: id}), nil
}
