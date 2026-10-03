package sponsorpg

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/sponsororder"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Create(ctx context.Context, in sponsor.NewOrder) (sponsor.Order, error) {
	row, err := r.db(ctx).SponsorOrder.Create().
		SetProviderOrderID(in.ProviderOrderID).
		SetProvider(in.Provider).
		SetAmount(formatCents(in.AmountCents)).
		SetNillableSponsorName(in.SponsorName).
		SetNillableSponsorMessage(in.Message).
		SetIsPrivate(in.IsPrivate).
		SetNillableUserID(in.UserID).
		SetExpiresAt(in.ExpiresAt).
		Save(ctx)
	if err != nil {
		return sponsor.Order{}, fmt.Errorf("create sponsor order: %w", err)
	}
	return toOrder(row)
}

func (r *Repository) Get(ctx context.Context, id int) (sponsor.Order, error) {
	return r.one(ctx, r.db(ctx).SponsorOrder.Query().Where(sponsororder.ID(id)))
}

func (r *Repository) Lock(ctx context.Context, id int) (sponsor.Order, error) {
	return r.one(ctx, r.db(ctx).SponsorOrder.Query().Where(sponsororder.ID(id)).ForUpdate())
}

func (r *Repository) FindByProviderOrderID(ctx context.Context, providerOrderID string) (sponsor.Order, error) {
	return r.one(ctx, r.db(ctx).SponsorOrder.Query().Where(sponsororder.ProviderOrderID(providerOrderID)))
}

func (r *Repository) one(ctx context.Context, query *ent.SponsorOrderQuery) (sponsor.Order, error) {
	row, err := query.Only(ctx)
	if postgres.IsNotFound(err) {
		return sponsor.Order{}, sponsor.ErrOrderNotFound
	}
	if err != nil {
		return sponsor.Order{}, fmt.Errorf("get sponsor order: %w", err)
	}
	order, err := toOrder(row)
	if err != nil {
		return sponsor.Order{}, err
	}
	if row.UserID != nil {
		owner, err := r.db(ctx).User.Query().Where(entuser.ID(*row.UserID)).Select(userpg.SummaryFields...).Only(ctx)
		if err != nil && !postgres.IsNotFound(err) {
			return sponsor.Order{}, fmt.Errorf("get sponsor order owner: %w", err)
		}
		order.User = userpg.ToSummaryPtr(owner)
	}
	return order, nil
}

func (r *Repository) SetPaymentMethod(ctx context.Context, id int, method string) error {
	err := r.db(ctx).SponsorOrder.UpdateOneID(id).SetPaymentMethod(method).Exec(ctx)
	if postgres.IsNotFound(err) {
		return sponsor.ErrOrderNotFound
	}
	if err != nil {
		return fmt.Errorf("set sponsor order %d payment method: %w", id, err)
	}
	return nil
}

func (r *Repository) ApplyStatus(ctx context.Context, id int, change sponsor.StatusChange) error {
	update := r.db(ctx).SponsorOrder.UpdateOneID(id).SetStatus(sponsororder.Status(change.Status))
	if change.PaidAt != nil {
		update.SetPaidAt(*change.PaidAt)
	}
	if change.CallbackVerified {
		update.SetCallbackVerified(true)
	}
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return sponsor.ErrOrderNotFound
	}
	if err != nil {
		return fmt.Errorf("update sponsor order %d status: %w", id, err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).SponsorOrder.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return sponsor.ErrOrderNotFound
	}
	if err != nil {
		return fmt.Errorf("delete sponsor order %d: %w", id, err)
	}
	return nil
}

func (r *Repository) List(ctx context.Context, filter sponsor.ListFilter, page sponsor.Page) ([]sponsor.Order, int, error) {
	query := r.db(ctx).SponsorOrder.Query()
	if filter.Status != nil {
		query.Where(sponsororder.StatusEQ(sponsororder.Status(*filter.Status)))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count sponsor orders: %w", err)
	}
	rows, err := query.
		WithUser(userpg.SelectSummary).
		Order(ent.Desc(sponsororder.FieldCreated), ent.Desc(sponsororder.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list sponsor orders: %w", err)
	}
	orders := make([]sponsor.Order, len(rows))
	for i, row := range rows {
		order, err := toOrder(row)
		if err != nil {
			return nil, 0, err
		}
		order.User = userpg.ToSummaryPtr(row.Edges.User)
		orders[i] = order
	}
	return orders, total, nil
}

func (r *Repository) Wall(ctx context.Context, page sponsor.Page) ([]sponsor.WallEntry, int, error) {
	query := r.db(ctx).SponsorOrder.Query().Where(
		sponsororder.StatusEQ(sponsororder.StatusDONE),
		sponsororder.IsPrivate(false),
	)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count sponsor wall: %w", err)
	}
	rows, err := query.
		WithUser(userpg.SelectSummary).
		Order(ent.Desc(sponsororder.FieldPaidAt), ent.Desc(sponsororder.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list sponsor wall: %w", err)
	}
	entries := make([]sponsor.WallEntry, len(rows))
	for i, row := range rows {
		cents, err := parseCents(row.Amount)
		if err != nil {
			return nil, 0, err
		}
		entry := sponsor.WallEntry{
			ID:          row.ID,
			SponsorName: row.SponsorName,
			Message:     row.SponsorMessage,
			User:        userpg.ToSummaryPtr(row.Edges.User),
			AmountCents: cents,
		}
		if row.PaidAt != nil {
			entry.PaidAt = *row.PaidAt
		}
		entries[i] = entry
	}
	return entries, total, nil
}

func (r *Repository) Stats(ctx context.Context) (sponsor.Stats, error) {
	rows, err := r.db(ctx).QueryContext(ctx, `SELECT COUNT(id), COALESCE(SUM(amount), 0)::text FROM sponsor_orders WHERE status = 'DONE'`)
	if err != nil {
		return sponsor.Stats{}, fmt.Errorf("aggregate sponsor orders: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var (
		count int
		sum   string
	)
	if rows.Next() {
		if err := rows.Scan(&count, &sum); err != nil {
			return sponsor.Stats{}, fmt.Errorf("scan sponsor stats: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return sponsor.Stats{}, fmt.Errorf("read sponsor stats: %w", err)
	}
	cents, err := parseCents(sum)
	if err != nil {
		return sponsor.Stats{}, err
	}
	return sponsor.Stats{TotalSponsors: count, TotalAmountCents: cents}, nil
}

func (r *Repository) ExpireStale(ctx context.Context, now time.Time) (int, error) {
	count, err := r.db(ctx).SponsorOrder.Update().
		Where(sponsororder.StatusEQ(sponsororder.StatusNEW), sponsororder.ExpiresAtLT(now)).
		SetStatus(sponsororder.StatusEXPIRED).
		Save(ctx)
	if err != nil {
		return 0, fmt.Errorf("expire stale sponsor orders: %w", err)
	}
	return count, nil
}

func (r *Repository) ExtendSponsorship(ctx context.Context, userID int, by time.Duration, now time.Time) error {
	row, err := r.db(ctx).User.Query().
		Where(entuser.ID(userID)).
		Select(entuser.FieldID, entuser.FieldSponsorExpiresAt).
		ForUpdate().
		Only(ctx)
	if postgres.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("lock sponsor user %d: %w", userID, err)
	}
	base := now
	if row.SponsorExpiresAt != nil && row.SponsorExpiresAt.After(now) {
		base = *row.SponsorExpiresAt
	}
	if err := r.db(ctx).User.UpdateOneID(userID).SetSponsorExpiresAt(base.Add(by)).Exec(ctx); err != nil {
		return fmt.Errorf("extend sponsorship of user %d: %w", userID, err)
	}
	return nil
}

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

func formatCents(cents int64) string {
	sign := ""
	if cents < 0 {
		sign, cents = "-", -cents
	}
	return fmt.Sprintf("%s%d.%02d", sign, cents/100, cents%100)
}

func parseCents(raw string) (int64, error) {
	text := strings.TrimSpace(raw)
	negative := strings.HasPrefix(text, "-")
	text = strings.TrimPrefix(text, "-")
	whole, fraction, _ := strings.Cut(text, ".")
	fraction = (fraction + "00")[:2]
	if whole == "" {
		whole = "0"
	}
	cents, err := strconv.ParseInt(whole+fraction, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse sponsor amount %q: %w", raw, err)
	}
	if negative {
		cents = -cents
	}
	return cents, nil
}
