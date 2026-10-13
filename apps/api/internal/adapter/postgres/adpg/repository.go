package adpg

import (
	"context"
	"fmt"
	"slices"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entad "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
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

func (r *Repository) Active(ctx context.Context, placement string, at time.Time) ([]ad.Ad, error) {
	rows, err := r.db(ctx).Ad.Query().
		Where(
			inPlacement(placement),
			entad.Enabled(true),
			entad.Or(entad.StartAtIsNil(), entad.StartAtLTE(at)),
			entad.Or(entad.EndAtIsNil(), entad.EndAtGTE(at)),
		).
		Order(ent.Asc(entad.FieldSort), ent.Asc(entad.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list active ads: %w", err)
	}
	return toAds(rows), nil
}

func (r *Repository) List(ctx context.Context, filter ad.ListFilter, page ad.Page) ([]ad.Ad, int, error) {
	query := r.db(ctx).Ad.Query()
	if filter.Placement != nil {
		query.Where(inPlacement(*filter.Placement))
	}
	if filter.Enabled != nil {
		query.Where(entad.Enabled(*filter.Enabled))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count ads: %w", err)
	}
	direction := ent.Asc
	if filter.Descending {
		direction = ent.Desc
	}
	rows, err := query.
		Order(direction(sortColumn(filter.SortBy)), direction(entad.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
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

func (r *Repository) Create(ctx context.Context, in ad.NewAd) (ad.Ad, error) {
	row, err := r.db(ctx).Ad.Create().
		SetName(in.Name).
		SetPlacement(textArray(in.Placement)).
		SetImageZh(in.ImageZH).
		SetNillableImageJa(in.ImageJA).
		SetNillableImageEn(in.ImageEN).
		SetAspect(in.Aspect).
		SetLink(in.Link).
		SetExcludeLocales(textArray(in.ExcludeLocales)).
		SetEnabled(in.Enabled).
		SetSort(in.Sort).
		SetNillableStartAt(in.StartAt).
		SetNillableEndAt(in.EndAt).
		Save(ctx)
	if err != nil {
		return ad.Ad{}, fmt.Errorf("create ad: %w", err)
	}
	return toAd(row), nil
}

func (r *Repository) Update(ctx context.Context, id int, changes ad.Changes) (ad.Ad, error) {
	update := r.db(ctx).Ad.UpdateOneID(id).
		SetNillableName(changes.Name).
		SetNillableImageZh(changes.ImageZH).
		SetNillableAspect(changes.Aspect).
		SetNillableLink(changes.Link).
		SetNillableEnabled(changes.Enabled).
		SetNillableSort(changes.Sort)
	if changes.Placement != nil {
		update.SetPlacement(textArray(*changes.Placement))
	}
	if changes.ExcludeLocales != nil {
		update.SetExcludeLocales(textArray(*changes.ExcludeLocales))
	}
	if changes.ImageJA.Set {
		if changes.ImageJA.Value == nil {
			update.ClearImageJa()
		} else {
			update.SetImageJa(*changes.ImageJA.Value)
		}
	}
	if changes.ImageEN.Set {
		if changes.ImageEN.Value == nil {
			update.ClearImageEn()
		} else {
			update.SetImageEn(*changes.ImageEN.Value)
		}
	}
	if changes.StartAt.Set {
		if changes.StartAt.Value == nil {
			update.ClearStartAt()
		} else {
			update.SetStartAt(*changes.StartAt.Value)
		}
	}
	if changes.EndAt.Set {
		if changes.EndAt.Value == nil {
			update.ClearEndAt()
		} else {
			update.SetEndAt(*changes.EndAt.Value)
		}
	}
	row, err := update.Save(ctx)
	if postgres.IsNotFound(err) {
		return ad.Ad{}, ad.ErrNotFound
	}
	if err != nil {
		return ad.Ad{}, fmt.Errorf("update ad %d: %w", id, err)
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

func (r *Repository) IsSponsor(ctx context.Context, userID int, at time.Time) (bool, error) {
	exists, err := r.db(ctx).User.Query().Where(entuser.ID(userID), entuser.SponsorExpiresAtGT(at)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check sponsor %d: %w", userID, err)
	}
	return exists, nil
}

func inPlacement(placement string) predicate.Ad {
	return predicate.Ad(func(s *entsql.Selector) {
		s.Where(entsql.P(func(b *entsql.Builder) {
			b.Ident(s.C(entad.FieldPlacement)).WriteString(" @> ARRAY[").Arg(placement).WriteString("]::text[]")
		}))
	})
}

func sortColumn(field ad.SortField) string {
	switch field {
	case ad.SortBySort:
		return entad.FieldSort
	case ad.SortByCreated:
		return entad.FieldCreated
	case ad.SortByUpdated:
		return entad.FieldUpdated
	default:
		return entad.FieldID
	}
}

func textArray(values []string) pgvalue.Strings {
	if values == nil {
		return pgvalue.Strings{}
	}
	return pgvalue.Strings(slices.Clone(values))
}
