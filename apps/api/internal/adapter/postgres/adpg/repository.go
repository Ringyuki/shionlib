package adpg

import (
	"context"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entad "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/addailystat"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
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

func (r *Repository) Enabled(ctx context.Context, slot ad.Slot) ([]ad.Ad, error) {
	rows, err := r.db(ctx).Ad.Query().
		Where(inSlot(slot), entad.Enabled(true)).
		Order(ent.Asc(entad.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list the enabled ads of slot %s: %w", slot, err)
	}
	return toAds(rows), nil
}

func (r *Repository) Running(ctx context.Context, now time.Time) ([]ad.Ad, error) {
	rows, err := r.db(ctx).Ad.Query().
		Where(statusIs(ad.StatusRunning, now)).
		Order(ent.Asc(entad.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list running ads: %w", err)
	}
	return toAds(rows), nil
}

func (r *Repository) List(ctx context.Context, filter ad.ListFilter, now time.Time, page ad.Page) ([]ad.Ad, int, error) {
	query := r.db(ctx).Ad.Query()
	if filter.Slot != nil {
		query.Where(inSlot(*filter.Slot))
	}
	if filter.Status != nil {
		query.Where(statusIs(*filter.Status, now))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count ads: %w", err)
	}
	rows, err := query.Order(ent.Desc(entad.FieldID)).Offset(page.Offset()).Limit(page.Size).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list ads: %w", err)
	}
	return toAds(rows), total, nil
}

func (r *Repository) Get(ctx context.Context, id int) (ad.Ad, error) {
	row, err := r.db(ctx).Ad.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return ad.Ad{}, ad.ErrNotFound
	}
	if err != nil {
		return ad.Ad{}, fmt.Errorf("get ad %d: %w", id, err)
	}
	return toAd(row), nil
}

func (r *Repository) Create(ctx context.Context, draft ad.Draft) (ad.Ad, error) {
	row, err := r.db(ctx).Ad.Create().
		SetName(draft.Name).
		SetLink(draft.Link).
		SetNillableBanner(draft.Banner).
		SetBannerAdult(draft.BannerAdult).
		SetNillableSideImage(draft.SideImage).
		SetNillableSideIcon(draft.SideIcon).
		SetSideAdult(draft.SideAdult).
		SetPlacement(slotArray(draft.Slots)).
		SetLanguages(textArray(draft.Languages)).
		SetWeight(draft.Weight).
		SetEnabled(draft.Enabled).
		SetNillableStartAt(utc(draft.StartAt)).
		SetNillableEndAt(utc(draft.EndAt)).
		Save(ctx)
	if err != nil {
		return ad.Ad{}, fmt.Errorf("create ad: %w", err)
	}
	return toAd(row), nil
}

func (r *Repository) Replace(ctx context.Context, id int, draft ad.Draft) (ad.Ad, error) {
	update := r.db(ctx).Ad.UpdateOneID(id).
		SetName(draft.Name).
		SetLink(draft.Link).
		SetBannerAdult(draft.BannerAdult).
		SetSideAdult(draft.SideAdult).
		SetPlacement(slotArray(draft.Slots)).
		SetLanguages(textArray(draft.Languages)).
		SetWeight(draft.Weight).
		SetEnabled(draft.Enabled)
	optional(draft.Banner, func(v string) { update.SetBanner(v) }, func() { update.ClearBanner() })
	optional(draft.SideImage, func(v string) { update.SetSideImage(v) }, func() { update.ClearSideImage() })
	optional(draft.SideIcon, func(v string) { update.SetSideIcon(v) }, func() { update.ClearSideIcon() })
	optional(utc(draft.StartAt), func(v time.Time) { update.SetStartAt(v) }, func() { update.ClearStartAt() })
	optional(utc(draft.EndAt), func(v time.Time) { update.SetEndAt(v) }, func() { update.ClearEndAt() })
	row, err := update.Save(ctx)
	if postgres.IsNotFound(err) {
		return ad.Ad{}, ad.ErrNotFound
	}
	if err != nil {
		return ad.Ad{}, fmt.Errorf("replace ad %d: %w", id, err)
	}
	return toAd(row), nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).Ad.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return ad.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete ad %d: %w", id, err)
	}
	return nil
}

func (r *Repository) AddViews(ctx context.Context, day time.Time, views map[ad.View]int) error {
	for view, count := range views {
		err := r.db(ctx).AdDailyStat.Create().
			SetAdID(view.AdID).
			SetSlot(string(view.Slot)).
			SetDay(day).
			SetViews(count).
			OnConflictColumns(addailystat.FieldAdID, addailystat.FieldSlot, addailystat.FieldDay).
			AddViews(count).
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("count views of ad %d: %w", view.AdID, err)
		}
	}
	return nil
}

func (r *Repository) AddClick(ctx context.Context, day time.Time, view ad.View) error {
	err := r.db(ctx).AdDailyStat.Create().
		SetAdID(view.AdID).
		SetSlot(string(view.Slot)).
		SetDay(day).
		SetClicks(1).
		OnConflictColumns(addailystat.FieldAdID, addailystat.FieldSlot, addailystat.FieldDay).
		AddClicks(1).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("count a click on ad %d: %w", view.AdID, err)
	}
	return nil
}

func (r *Repository) Counts(ctx context.Context, ids []int, from, to time.Time) ([]ad.DailyCount, error) {
	query := r.db(ctx).AdDailyStat.Query().Where(addailystat.DayGTE(from), addailystat.DayLTE(to))
	if ids != nil {
		query.Where(addailystat.AdIDIn(ids...))
	}
	rows, err := query.All(ctx)
	if err != nil {
		return nil, fmt.Errorf("read ad counts: %w", err)
	}
	counts := make([]ad.DailyCount, len(rows))
	for i, row := range rows {
		counts[i] = ad.DailyCount{AdID: row.AdID, Slot: ad.Slot(row.Slot), Day: row.Day.UTC(), Counts: ad.Counts{Views: row.Views, Clicks: row.Clicks}}
	}
	return counts, nil
}

func (r *Repository) IsSponsor(ctx context.Context, userID int, at time.Time) (bool, error) {
	exists, err := r.db(ctx).User.Query().Where(entuser.ID(userID), entuser.SponsorExpiresAtGT(at)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check sponsor %d: %w", userID, err)
	}
	return exists, nil
}

func inSlot(slot ad.Slot) predicate.Ad {
	return predicate.Ad(func(s *entsql.Selector) {
		s.Where(entsql.P(func(b *entsql.Builder) {
			b.Ident(s.C(entad.FieldPlacement)).WriteString(" @> ARRAY[").Arg(string(slot)).WriteString("]::text[]")
		}))
	})
}

func statusIs(status ad.Status, now time.Time) predicate.Ad {
	started := entad.Or(entad.StartAtIsNil(), entad.StartAtLTE(now))
	open := entad.Or(entad.EndAtIsNil(), entad.EndAtGT(now))
	switch status {
	case ad.StatusDisabled:
		return entad.Enabled(false)
	case ad.StatusEnded:
		return entad.And(entad.Enabled(true), entad.EndAtLTE(now))
	case ad.StatusScheduled:
		return entad.And(entad.Enabled(true), open, entad.StartAtGT(now))
	}
	return entad.And(entad.Enabled(true), started, open)
}

func optional[T any](value *T, set func(T), clear func()) {
	if value == nil {
		clear()
		return
	}
	set(*value)
}

func utc(at *time.Time) *time.Time {
	if at == nil {
		return nil
	}
	value := at.UTC()
	return &value
}
