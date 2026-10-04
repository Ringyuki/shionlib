package game

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type AdminDeps struct {
	Store   AdminStore
	Recent  RecentUpdateMarks
	Catalog CatalogExclusions
	Purger  ObjectPurger
	Tx      Transactor
	Now     func() time.Time
}

type AdminService struct {
	store   AdminStore
	recent  RecentUpdateMarks
	catalog CatalogExclusions
	purger  ObjectPurger
	tx      Transactor
	now     func() time.Time
}

func NewAdminService(deps AdminDeps) *AdminService {
	return &AdminService{store: deps.Store, recent: deps.Recent, catalog: deps.Catalog, purger: deps.Purger, tx: deps.Tx, now: deps.Now}
}

func (s *AdminService) Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error) {
	filter.Search = strings.TrimSpace(filter.Search)
	return s.store.Search(ctx, filter, page)
}

func (s *AdminService) Scalar(ctx context.Context, id int) (Scalar, error) {
	return s.store.Scalar(ctx, id)
}

func (s *AdminService) SetStatus(ctx context.Context, id int, status Status) error {
	return s.store.SetStatus(ctx, id, status)
}

func (s *AdminService) EditScalar(ctx context.Context, id int, changes ScalarChanges) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.store.Lock(ctx, id); err != nil {
			return err
		}
		if changes.Empty() {
			return nil
		}
		return s.store.UpdateScalar(ctx, id, changes.normalized())
	})
}

func (s *AdminService) Delete(ctx context.Context, id int) error {
	var keys []string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.store.Lock(ctx, id); err != nil {
			return err
		}
		var err error
		if keys, err = s.store.StorageKeys(ctx, id); err != nil {
			return err
		}
		if err := s.store.Delete(ctx, id); err != nil {
			return err
		}
		return s.catalog.Exclude(ctx, catalog.EntityGame, id)
	})
	if err != nil {
		return err
	}
	return errors.Join(s.recent.Remove(ctx, id), s.purger.PurgeLater(ctx, keys))
}

func (s *AdminService) MarkRecentlyUpdated(ctx context.Context, id int) error {
	return s.recent.Add(ctx, id, s.now())
}

func (s *AdminService) UnmarkRecentlyUpdated(ctx context.Context, id int) error {
	return s.recent.Remove(ctx, id)
}
