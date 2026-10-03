package sponsorhttp

import (
	"bytes"
	"context"
	"encoding/json"
	"mime"
	"net/http"
	"net/url"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var (
	tags      = []string{"sponsor"}
	adminTags = []string{"sponsor", "admin"}
)

type Handler struct {
	service *sponsor.Service
	resp    *response.Builder
}

func NewHandler(service *sponsor.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "sponsor.order.create", Method: http.MethodPost, Path: "/sponsor/order", Summary: "Create a sponsor order", Tags: tags}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.order.pay", Method: http.MethodPost, Path: "/sponsor/order/{id}/pay", Summary: "Start paying a sponsor order", Tags: tags}, h.pay)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.order.get", Method: http.MethodGet, Path: "/sponsor/order/{id}", Summary: "Get a sponsor order and refresh its status for the owner", Tags: tags}, h.order)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.wall", Method: http.MethodGet, Path: "/sponsor/wall", Summary: "List public sponsors", Tags: tags}, h.wall)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.stats", Method: http.MethodGet, Path: "/sponsor/stats", Summary: "Sponsorship totals", Tags: tags}, h.stats)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.webhook.idatariver", Method: http.MethodPost, Path: "/sponsor/webhook/idatariver", Summary: "iDataRiver payment callback", Tags: tags, Status: http.StatusOK}, h.webhook)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.admin.orders", Method: http.MethodGet, Path: "/admin/sponsor/orders", Summary: "List sponsor orders", Tags: adminTags, Access: httpapi.AccessAdmin}, h.adminList)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.admin.order", Method: http.MethodGet, Path: "/admin/sponsor/orders/{id}", Summary: "Get a sponsor order", Tags: adminTags, Access: httpapi.AccessAdmin}, h.adminOrder)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.admin.updateStatus", Method: http.MethodPatch, Path: "/admin/sponsor/orders/{id}/status", Summary: "Override a sponsor order status", Tags: adminTags, Access: httpapi.AccessAdmin}, h.adminUpdateStatus)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.admin.delete", Method: http.MethodDelete, Path: "/admin/sponsor/orders/{id}", Summary: "Delete a sponsor order", Tags: adminTags, Access: httpapi.AccessAdmin}, h.adminDelete)
	httpapi.Register(api, httpapi.Route{ID: "sponsor.admin.stats", Method: http.MethodGet, Path: "/admin/sponsor/stats", Summary: "Sponsorship totals", Tags: adminTags, Access: httpapi.AccessAdmin}, h.stats)
}

func (h *Handler) create(ctx context.Context, in *createSponsorOrderInput) (*response.Output[sponsorOrderCreatedDTO], error) {
	created, err := h.service.CreateOrder(ctx, actor.From(ctx), sponsor.CreateOrderInput{
		AmountCents: sponsor.CentsFromAmount(in.Body.Amount),
		IsPrivate:   deref(in.Body.IsPrivate),
		Name:        deref(in.Body.Name),
		Message:     deref(in.Body.Message),
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, sponsorOrderCreatedDTO{
		OrderID:         created.OrderID,
		ProviderOrderID: created.ProviderOrderID,
		PaymentMethods:  toPaymentMethods(created.PaymentMethods),
		ExpiresAt:       created.ExpiresAt,
		AccessToken:     created.AccessToken,
	}), nil
}

func (h *Handler) pay(ctx context.Context, in *paySponsorOrderInput) (*response.Output[sponsorPaymentDTO], error) {
	payment, err := h.service.PayOrder(ctx, in.ID, sponsor.PayInput{Method: in.Body.Method, RedirectURL: in.Body.RedirectURL})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, sponsorPaymentDTO{PayURL: payment.PayURL, PayCurrency: payment.PayCurrency, Amount: payment.Amount}), nil
}

func (h *Handler) order(ctx context.Context, in *getSponsorOrderInput) (*response.Output[sponsorOrderDTO], error) {
	view, err := h.service.Order(ctx, actor.From(ctx), in.ID, in.Token)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toOrderDTO(view.Order, h.resp.Now())), nil
}

func (h *Handler) wall(ctx context.Context, in *sponsorWallInput) (*response.Output[response.Page[sponsorWallItemDTO]], error) {
	page, err := h.service.Wall(ctx, sponsor.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(page.Entries, page.Total, in.PageSize, in.Page, func(entry sponsor.WallEntry) sponsorWallItemDTO {
		return toWallItemDTO(entry, now)
	})), nil
}

func (h *Handler) stats(ctx context.Context, _ *struct{}) (*response.Output[sponsorStatsDTO], error) {
	stats, err := h.service.Stats(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toStatsDTO(stats)), nil
}

func (h *Handler) webhook(ctx context.Context, in *sponsorWebhookInput) (*response.Output[sponsorWebhookDTO], error) {
	if orderID := callbackOrderID(in.ContentType, in.RawBody); orderID != "" {
		if err := h.service.HandleCallback(ctx, orderID); err != nil {
			return nil, err
		}
	}
	return response.OK(ctx, h.resp, sponsorWebhookDTO{Received: true}), nil
}

func (h *Handler) adminList(ctx context.Context, in *listSponsorOrdersInput) (*response.Output[response.Page[sponsorOrderDTO]], error) {
	var filter sponsor.ListFilter
	if in.Status != "" {
		status := sponsor.Status(in.Status)
		filter.Status = &status
	}
	orders, total, err := h.service.List(ctx, filter, sponsor.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(orders, total, in.PageSize, in.Page, func(order sponsor.Order) sponsorOrderDTO {
		return toOrderDTO(order, now)
	})), nil
}

func (h *Handler) adminOrder(ctx context.Context, in *sponsorOrderPath) (*response.Output[sponsorOrderDTO], error) {
	order, err := h.service.AdminOrder(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toOrderDTO(order, h.resp.Now())), nil
}

func (h *Handler) adminUpdateStatus(ctx context.Context, in *updateSponsorOrderStatusInput) (*response.EmptyOutput, error) {
	if err := h.service.AdminUpdateStatus(ctx, in.ID, sponsor.Status(in.Body.Status)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) adminDelete(ctx context.Context, in *sponsorOrderPath) (*response.EmptyOutput, error) {
	if err := h.service.AdminDelete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func callbackOrderID(contentType string, raw []byte) string {
	mediaType, _, _ := mime.ParseMediaType(contentType)
	if mediaType == "application/x-www-form-urlencoded" {
		values, err := url.ParseQuery(string(raw))
		if err != nil {
			return ""
		}
		return values.Get("orderId")
	}
	var body map[string]any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&body); err != nil {
		return ""
	}
	switch value := body["orderId"].(type) {
	case string:
		return value
	case json.Number:
		return value.String()
	default:
		return ""
	}
}

func deref[T any](value *T) T {
	var zero T
	if value == nil {
		return zero
	}
	return *value
}
