package main

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/idatariver"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/sponsororder"
)

const (
	e2eSponsorProvider = idatariver.Name
	e2eSponsorMessage  = "Seeded sponsor message."
	e2eSponsorGuest    = "Seeded Guest"
	e2eSponsorPasserby = "Seeded Passerby"
	e2eSponsorEarlier  = "Earlier seeded message."
	e2eSponsorGuestSay = "Seeded guest message."
	e2eSponsorOpenFor  = 30 * 24 * time.Hour
)

type e2eSponsorOrder struct {
	number  string
	amount  string
	status  sponsororder.Status
	method  string
	userID  int
	name    string
	message string
	private bool
	paid    time.Duration
}

func (s *e2eSeeder) seedSponsorOrders(ctx context.Context, tx *ent.Client, memberID int) error {
	now := s.now().UTC()
	orders := []e2eSponsorOrder{
		{number: "e2e-order-member-earlier", amount: "2.00", status: sponsororder.StatusDONE, method: "alipay", userID: memberID, message: e2eSponsorEarlier, paid: 80 * 24 * time.Hour},
		{number: "e2e-order-passerby", amount: "4.00", status: sponsororder.StatusDONE, method: "wxpay", name: e2eSponsorPasserby, message: e2eSponsorGuestSay, paid: 45 * 24 * time.Hour},
		{number: "e2e-order-refunded", amount: "8.00", status: sponsororder.StatusREFUND, method: "alipay", paid: 10 * 24 * time.Hour},
		{number: "e2e-order-expired", amount: "3.00", status: sponsororder.StatusEXPIRED},
		{number: "e2e-order-unpaid", amount: "10.00", status: sponsororder.StatusNEW, name: e2eSponsorGuest},
		{number: "e2e-order-anonymous", amount: "5.00", status: sponsororder.StatusDONE, method: "wxpay", private: true, paid: 400 * 24 * time.Hour},
		{number: "e2e-order-member", amount: "20.00", status: sponsororder.StatusDONE, method: "alipay", userID: memberID, message: e2eSponsorMessage, paid: time.Minute},
	}
	for index, order := range orders {
		create := tx.SponsorOrder.Create().
			SetProviderOrderID(order.number).
			SetProvider(e2eSponsorProvider).
			SetAmount(order.amount).
			SetStatus(order.status).
			SetIsPrivate(order.private).
			SetExpiresAt(now.Add(e2eSponsorOpenFor)).
			SetCreated(now.Add(-order.paid - time.Duration(len(orders)-index)*time.Minute))
		if order.method != "" {
			create.SetPaymentMethod(order.method)
		}
		if order.userID != 0 {
			create.SetUserID(order.userID)
		}
		if order.name != "" {
			create.SetSponsorName(order.name)
		}
		if order.message != "" {
			create.SetSponsorMessage(order.message)
		}
		if order.paid != 0 {
			create.SetPaidAt(now.Add(-order.paid))
		}
		if err := create.Exec(ctx); err != nil {
			return fmt.Errorf("seed sponsor order %s: %w", order.number, err)
		}
	}
	return nil
}
