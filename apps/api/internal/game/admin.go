package game

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

type Status int

const (
	StatusVisible Status = 1
	StatusHidden  Status = 2
)

func (s Status) Valid() bool {
	return s == StatusVisible || s == StatusHidden
}

type AdminSortField string

const (
	AdminSortByID        AdminSortField = "id"
	AdminSortByTitleJP   AdminSortField = "title_jp"
	AdminSortByViews     AdminSortField = "views"
	AdminSortByDownloads AdminSortField = "downloads"
	AdminSortByCreated   AdminSortField = "created"
	AdminSortByUpdated   AdminSortField = "updated"
)

type AdminFilter struct {
	Search     string
	Status     *Status
	SortBy     AdminSortField
	Descending bool
}

type CreatorRef struct {
	ID   int
	Name string
}

type AdminEntry struct {
	ID        int
	TitleJP   string
	TitleZH   string
	TitleEN   string
	Status    Status
	Views     int
	Downloads int
	NSFW      bool
	Created   time.Time
	Updated   time.Time
	CoverURL  *string
	Creator   CreatorRef
}

type Scalar struct {
	BID            *string
	VID            *string
	TitleJP        string
	TitleZH        string
	TitleEN        string
	Aliases        []string
	IntroJP        string
	IntroZH        string
	IntroEN        string
	ReleaseDate    *time.Time
	ReleaseDateTBA bool
	ExtraInfo      json.RawMessage
	Staffs         json.RawMessage
	NSFW           bool
	Type           *string
	Platform       []string
	Status         Status
}

type Clearable[T any] struct {
	Set   bool
	Value *T
}

type ScalarChanges struct {
	BID            Clearable[string]
	VID            Clearable[string]
	TitleJP        *string
	TitleZH        *string
	TitleEN        *string
	Aliases        *[]string
	IntroJP        *string
	IntroZH        *string
	IntroEN        *string
	ReleaseDate    Clearable[time.Time]
	ReleaseDateTBA *bool
	ExtraInfo      Clearable[[]ExtraInfo]
	Staffs         Clearable[[]Staff]
	NSFW           *bool
	Type           Clearable[string]
	Platform       *[]string
	Status         *Status
}

func (c ScalarChanges) Empty() bool {
	return !c.BID.Set && !c.VID.Set && c.TitleJP == nil && c.TitleZH == nil && c.TitleEN == nil &&
		c.Aliases == nil && c.IntroJP == nil && c.IntroZH == nil && c.IntroEN == nil &&
		!c.ReleaseDate.Set && c.ReleaseDateTBA == nil && !c.ExtraInfo.Set && !c.Staffs.Set &&
		c.NSFW == nil && !c.Type.Set && c.Platform == nil && c.Status == nil
}

func (c ScalarChanges) normalized() ScalarChanges {
	c.BID = blankAsNull(c.BID)
	c.VID = blankAsNull(c.VID)
	c.Type = blankAsNull(c.Type)
	c.ExtraInfo = nullAsEmpty(c.ExtraInfo)
	c.Staffs = nullAsEmpty(c.Staffs)
	return c
}

func blankAsNull(value Clearable[string]) Clearable[string] {
	if value.Set && value.Value != nil && strings.TrimSpace(*value.Value) == "" {
		value.Value = nil
	}
	return value
}

func nullAsEmpty[T any](value Clearable[[]T]) Clearable[[]T] {
	if value.Set && value.Value == nil {
		empty := []T{}
		value.Value = &empty
	}
	return value
}

type AdminDeps struct {
	Store   AdminStore
	Recent  RecentUpdateMarks
	Catalog CatalogExclusions
	Purger  ObjectPurger
	Index   SearchIndex
	Tx      Transactor
	Now     func() time.Time
}

type AdminService struct {
	store   AdminStore
	recent  RecentUpdateMarks
	catalog CatalogExclusions
	purger  ObjectPurger
	index   SearchIndex
	tx      Transactor
	now     func() time.Time
}

func NewAdminService(deps AdminDeps) *AdminService {
	return &AdminService{store: deps.Store, recent: deps.Recent, catalog: deps.Catalog, purger: deps.Purger, index: deps.Index, tx: deps.Tx, now: deps.Now}
}

func (s *AdminService) Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error) {
	filter.Search = strings.TrimSpace(filter.Search)
	return s.store.Search(ctx, filter, page)
}

func (s *AdminService) Scalar(ctx context.Context, id int) (Scalar, error) {
	return s.store.Scalar(ctx, id)
}

func (s *AdminService) SetStatus(ctx context.Context, id int, status Status) error {
	if err := s.store.SetStatus(ctx, id, status); err != nil {
		return err
	}
	return s.index.GamesChanged(ctx, []int{id})
}

func (s *AdminService) EditScalar(ctx context.Context, id int, changes ScalarChanges) error {
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.store.Lock(ctx, id); err != nil {
			return err
		}
		if changes.Empty() {
			return nil
		}
		return s.store.UpdateScalar(ctx, id, changes.normalized())
	})
	if err != nil || changes.Empty() {
		return err
	}
	return s.index.GamesChanged(ctx, []int{id})
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
	return errors.Join(s.recent.Remove(ctx, id), s.purger.PurgeLater(ctx, keys), s.index.GamesChanged(ctx, []int{id}))
}

func (s *AdminService) MarkRecentlyUpdated(ctx context.Context, id int) error {
	return s.recent.Add(ctx, id, s.now())
}

func (s *AdminService) UnmarkRecentlyUpdated(ctx context.Context, id int) error {
	return s.recent.Remove(ctx, id)
}
