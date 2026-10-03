package sponsorhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type sponsorPaymentMethodDTO struct {
	Method        string  `json:"method"`
	Name          string  `json:"name"`
	Enabled       bool    `json:"enabled"`
	RatioRange    *string `json:"ratioRange,omitempty"`
	FixedFeeRange *string `json:"fixedFeeRange,omitempty"`
	Desc          *string `json:"desc,omitempty"`
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
	PaymentMethod   *string                  `json:"paymentMethod"`
	PaidAt          *time.Time               `json:"paidAt"`
	Created         time.Time                `json:"created"`
}

type sponsorWallItemDTO struct {
	ID          int                      `json:"id"`
	SponsorName *string                  `json:"sponsorName"`
	Message     *string                  `json:"message"`
	User        *userhttp.UserSummaryDTO `json:"user"`
	Amount      float64                  `json:"amount"`
	PaidAt      time.Time                `json:"paidAt"`
}

type sponsorStatsDTO struct {
	TotalSponsors int     `json:"totalSponsors"`
	TotalAmount   float64 `json:"totalAmount"`
}

type sponsorWebhookDTO struct {
	Received bool `json:"received"`
}

func toPaymentMethods(methods []sponsor.PaymentMethod) []sponsorPaymentMethodDTO {
	out := make([]sponsorPaymentMethodDTO, len(methods))
	for i, method := range methods {
		out[i] = sponsorPaymentMethodDTO{
			Method:        method.Method,
			Name:          method.Name,
			Enabled:       method.Enabled,
			RatioRange:    method.RatioRange,
			FixedFeeRange: method.FixedFeeRange,
			Desc:          method.Description,
		}
	}
	return out
}

func toOrderDTO(order sponsor.Order, now time.Time) sponsorOrderDTO {
	return sponsorOrderDTO{
		ID:              order.ID,
		ProviderOrderID: order.ProviderOrderID,
		Amount:          sponsor.Amount(order.AmountCents),
		Status:          string(order.Status),
		SponsorName:     order.SponsorName,
		User:            userhttp.ToUserSummaryPtr(order.User, now),
		Message:         order.Message,
		IsPrivate:       order.IsPrivate,
		PaymentMethod:   order.PaymentMethod,
		PaidAt:          order.PaidAt,
		Created:         order.Created,
	}
}

func toWallItemDTO(entry sponsor.WallEntry, now time.Time) sponsorWallItemDTO {
	return sponsorWallItemDTO{
		ID:          entry.ID,
		SponsorName: entry.SponsorName,
		Message:     entry.Message,
		User:        userhttp.ToUserSummaryPtr(entry.User, now),
		Amount:      sponsor.Amount(entry.AmountCents),
		PaidAt:      entry.PaidAt,
	}
}

func toStatsDTO(stats sponsor.Stats) sponsorStatsDTO {
	return sponsorStatsDTO{TotalSponsors: stats.TotalSponsors, TotalAmount: sponsor.Amount(stats.TotalAmountCents)}
}
