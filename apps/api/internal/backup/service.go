package backup

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

type Service struct {
	dumper    Dumper
	store     Store
	retention Retention
	now       func() time.Time
}

func NewService(dumper Dumper, store Store, retention Retention, now func() time.Time) *Service {
	return &Service{dumper: dumper, store: store, retention: retention, now: now}
}

func (s *Service) RunDaily(ctx context.Context) error {
	return s.Run(ctx, TierDaily)
}

func (s *Service) RunWeekly(ctx context.Context) error {
	return s.Run(ctx, TierWeekly)
}

func (s *Service) Run(ctx context.Context, tier Tier) error {
	key := tier.Prefix() + strings.ReplaceAll(s.now().UTC().Format("2006-01-02T15:04:05.000Z"), ":", "-") + keySuffix
	dump, err := s.dumper.Dump(ctx)
	if err != nil {
		return fmt.Errorf("start database dump: %w", err)
	}
	uploadErr := s.store.Upload(ctx, key, ContentType, dump)
	closeErr := dump.Close()
	if err := errors.Join(uploadErr, closeErr); err != nil {
		return fmt.Errorf("upload database backup %s: %w", key, err)
	}
	return s.prune(ctx, tier, key)
}

func (s *Service) prune(ctx context.Context, tier Tier, latestKey string) error {
	keep := s.retention.For(tier)
	if keep <= 0 {
		return nil
	}
	objects, err := s.store.List(ctx, tier.Prefix())
	if err != nil {
		return fmt.Errorf("list %s backups: %w", tier, err)
	}
	if len(objects) <= keep {
		return nil
	}
	slices.SortFunc(objects, func(a, b Object) int {
		if c := b.LastModified.Compare(a.LastModified); c != 0 {
			return c
		}
		return cmp.Compare(b.Key, a.Key)
	})
	var errs []error
	for _, object := range objects[keep:] {
		if object.Key == latestKey {
			continue
		}
		if err := s.store.Delete(ctx, object.Key); err != nil {
			errs = append(errs, fmt.Errorf("delete old backup %s: %w", object.Key, err))
		}
	}
	return errors.Join(errs...)
}
