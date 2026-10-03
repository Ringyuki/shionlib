package sponsorpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

func toOrder(row *ent.SponsorOrder) (sponsor.Order, error) {
	cents, err := parseCents(row.Amount)
	if err != nil {
		return sponsor.Order{}, err
	}
	return sponsor.Order{
		ID:               row.ID,
		ProviderOrderID:  row.ProviderOrderID,
		Provider:         row.Provider,
		AmountCents:      cents,
		PaymentMethod:    row.PaymentMethod,
		Status:           sponsor.Status(row.Status),
		SponsorName:      row.SponsorName,
		Message:          row.SponsorMessage,
		IsPrivate:        row.IsPrivate,
		UserID:           row.UserID,
		ExpiresAt:        row.ExpiresAt,
		PaidAt:           row.PaidAt,
		CallbackVerified: row.CallbackVerified,
		Created:          row.Created,
	}, nil
}
