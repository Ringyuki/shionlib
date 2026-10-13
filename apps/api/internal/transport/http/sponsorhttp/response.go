package sponsorhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type sponsorPaymentMethodDTO struct {
	ID       string  `json:"id" doc:"What the payment provider calls the method; sent back to pay with it"`
	Name     string  `json:"name" doc:"The provider's own name for the method"`
	Brand    *string `json:"brand" enum:"alipay,wechat_pay,paypal,google_pay,apple_pay,usdt" doc:"The payment brand behind the method when the provider's adapter knows it"`
	FeeRate  *string `json:"fee_rate" doc:"The share of the amount the provider charges for paying this way, as the provider words it (for example 3.0%); null when it charges none or the method is only named, as on a paid order"`
	FeeFixed *string `json:"fee_fixed" doc:"The fixed part of the provider's fee as the provider words it; null when there is none"`
}

type sponsorOrderCreatedDTO struct {
	OrderID         int                       `json:"orderId"`
	ProviderOrderID string                    `json:"providerOrderId"`
	PaymentMethods  []sponsorPaymentMethodDTO `json:"paymentMethods"`
	ExpiresAt       *time.Time                `json:"expiresAt"`
	AccessToken     string                    `json:"accessToken" doc:"Pass as ?token= to GET /sponsor/order/{id} to refresh an order without signing in"`
}

type sponsorPaymentDTO struct {
	PayURL      string   `json:"payUrl"`
	PayCurrency *string  `json:"payCurrency"`
	Amount      *float64 `json:"amount"`
}

type sponsorOrderDTO struct {
	ID              int                      `json:"id"`
	ProviderOrderID string                   `json:"providerOrderId"`
	Amount          float64                  `json:"amount"`
	Status          string                   `json:"status" enum:"NEW,DONE,EXPIRED,REFUND"`
	SponsorName     *string                  `json:"sponsorName"`
	User            *userhttp.UserSummaryDTO `json:"user"`
	Message         *string                  `json:"message"`
	IsPrivate       bool                     `json:"isPrivate"`
	PaymentMethod   *sponsorPaymentMethodDTO `json:"paymentMethod" doc:"What the order was last paid or tried with"`
	PaidAt          *time.Time               `json:"paidAt"`
	ExpiresAt       *time.Time               `json:"expiresAt" doc:"Until when the order can be paid"`
	Created         time.Time                `json:"created"`
}

type sponsorOrderViewDTO struct {
	Order          sponsorOrderDTO           `json:"order"`
	BadgeUntil     *time.Time                `json:"badge_until" doc:"Until when the sponsor badge is shown once the order is paid, or is shown now when it is paid already; null without an account"`
	PaymentMethods []sponsorPaymentMethodDTO `json:"payment_methods" doc:"What an order that waits for payment can be paid with; empty otherwise and for anyone but its owner"`
}

type sponsorWallUserDTO struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Avatar    *string `json:"avatar"`
	Cover     *string `json:"cover"`
	Bio       *string `json:"bio"`
	IsSponsor bool    `json:"is_sponsor" doc:"Whether the sponsor badge is still shown"`
}

type sponsorWallEntryDTO struct {
	ID          int                 `json:"id"`
	User        *sponsorWallUserDTO `json:"user" doc:"The sponsor's account with what its profile shows; null when the payment was made without one"`
	Name        *string             `json:"name" doc:"The name a sponsor without an account gave"`
	Message     *string             `json:"message"`
	SponsoredAt time.Time           `json:"sponsored_at" doc:"When the sponsor last paid"`
}

type sponsorStateDTO struct {
	Enabled            bool `json:"enabled" doc:"Whether new sponsor orders are accepted"`
	BadgeDaysPerDollar int  `json:"badge_days_per_dollar" doc:"Days the sponsor badge is shown for each dollar"`
}

type sponsorStatsDTO struct {
	TotalSponsors int     `json:"totalSponsors"`
	TotalAmount   float64 `json:"totalAmount"`
}

type adminSponsorStatsDTO struct {
	TotalSponsors int     `json:"totalSponsors" doc:"Completed orders"`
	TotalAmount   float64 `json:"totalAmount"`
	MonthAmount   float64 `json:"monthAmount" doc:"Paid since the month began on the site's clock"`
	Enabled       bool    `json:"enabled" doc:"Whether the setting that opens sponsorship is on"`
	ProviderReady bool    `json:"providerReady" doc:"Whether the payment provider has what it needs to take payments"`
}

func toAdminStatsDTO(overview sponsor.Overview) adminSponsorStatsDTO {
	return adminSponsorStatsDTO{
		TotalSponsors: overview.Totals.TotalSponsors,
		TotalAmount:   sponsor.Amount(overview.Totals.TotalAmountCents),
		MonthAmount:   sponsor.Amount(overview.MonthAmountCents),
		Enabled:       overview.Enabled,
		ProviderReady: overview.ProviderReady,
	}
}

type sponsorWebhookDTO struct {
	Received bool `json:"received"`
}

func toPaymentMethods(methods []sponsor.PaymentMethod) []sponsorPaymentMethodDTO {
	out := make([]sponsorPaymentMethodDTO, len(methods))
	for i, method := range methods {
		out[i] = toPaymentMethod(method)
	}
	return out
}

func toPaymentMethod(method sponsor.PaymentMethod) sponsorPaymentMethodDTO {
	dto := sponsorPaymentMethodDTO{ID: method.ID, Name: method.Name, FeeRate: present(method.Fee.Rate), FeeFixed: present(method.Fee.Fixed)}
	if method.Brand != "" {
		brand := string(method.Brand)
		dto.Brand = &brand
	}
	return dto
}

func toOrderDTO(order sponsor.Order, method *sponsor.PaymentMethod, now time.Time) sponsorOrderDTO {
	var paidWith *sponsorPaymentMethodDTO
	if method != nil {
		dto := toPaymentMethod(*method)
		paidWith = &dto
	}
	return sponsorOrderDTO{
		ID:              order.ID,
		ProviderOrderID: order.ProviderOrderID,
		Amount:          sponsor.Amount(order.AmountCents),
		Status:          string(order.Status),
		SponsorName:     order.SponsorName,
		User:            userhttp.ToUserSummaryPtr(order.User, now),
		Message:         order.Message,
		IsPrivate:       order.IsPrivate,
		PaymentMethod:   paidWith,
		PaidAt:          order.PaidAt,
		ExpiresAt:       order.ExpiresAt,
		Created:         order.Created,
	}
}

func toOrderViewDTO(view sponsor.OrderView, method *sponsor.PaymentMethod, now time.Time) sponsorOrderViewDTO {
	return sponsorOrderViewDTO{
		Order:          toOrderDTO(view.Order, method, now),
		BadgeUntil:     view.Order.BadgeUntil(now),
		PaymentMethods: toPaymentMethods(view.PaymentMethods),
	}
}

func toWallEntryDTO(entry sponsor.WallEntry, now time.Time) sponsorWallEntryDTO {
	dto := sponsorWallEntryDTO{ID: entry.OrderID, Name: entry.Name, Message: entry.Message, SponsoredAt: entry.PaidAt}
	if who := entry.Sponsor; who != nil {
		dto.User = &sponsorWallUserDTO{ID: who.ID, Name: who.Name, Avatar: who.Avatar, Cover: who.Cover, Bio: who.Bio, IsSponsor: who.IsSponsor(now)}
	}
	return dto
}

func toStatsDTO(stats sponsor.Stats) sponsorStatsDTO {
	return sponsorStatsDTO{TotalSponsors: stats.TotalSponsors, TotalAmount: sponsor.Amount(stats.TotalAmountCents)}
}

func present(text string) *string {
	if text == "" {
		return nil
	}
	return &text
}
