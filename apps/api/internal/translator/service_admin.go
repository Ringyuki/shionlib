package translator

import (
	"context"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

type AdminService struct {
	repo  Repository
	store AdminStore
	tx    Transactor
}

func NewAdminService(repo Repository, store AdminStore, tx Transactor) *AdminService {
	return &AdminService{repo: repo, store: store, tx: tx}
}

func (s *AdminService) Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error) {
	filter.Search = strings.TrimSpace(filter.Search)
	return s.store.Search(ctx, filter, page)
}

func (s *AdminService) Edit(ctx context.Context, id int, changes Changes) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		name := current.Name
		if changes.Name != nil {
			name = Clean(*changes.Name)
			if name == "" || utf8.RuneCountInString(name) > MaxNameLength {
				return apperror.ErrValidationFailed.WithField("name", "the name must have 1 to 64 characters")
			}
			changes.Name = &name
		}
		aliases := current.Aliases
		if changes.Aliases != nil {
			aliases = uniqueByKey(*changes.Aliases, name)
			if len(aliases) > MaxAliases {
				return apperror.ErrValidationFailed.WithField("aliases", "too many aliases")
			}
		} else {
			aliases = uniqueByKey(aliases, name)
		}
		changes.Aliases = &aliases
		if err := s.free(ctx, id, append([]string{name}, aliases...)); err != nil {
			return err
		}
		if changes.Homepage.Set && changes.Homepage.Value != nil {
			homepage := strings.TrimSpace(*changes.Homepage.Value)
			changes.Homepage.Value = &homepage
			if homepage == "" {
				changes.Homepage.Value = nil
			}
		}
		return s.repo.Update(ctx, id, changes)
	})
}

func (s *AdminService) free(ctx context.Context, id int, names []string) error {
	holders, err := s.repo.FindByKeys(ctx, keysOf(names))
	if err != nil {
		return err
	}
	if slices.ContainsFunc(holders, func(holder Translator) bool { return holder.ID != id }) {
		return ErrNameTaken
	}
	return nil
}

func (s *AdminService) Merge(ctx context.Context, keepID int, mergeIDs []int) error {
	mergeIDs = slices.DeleteFunc(slices.Compact(slices.Sorted(slices.Values(mergeIDs))), func(id int) bool { return id == keepID })
	if len(mergeIDs) == 0 {
		return ErrMergeNeedsOthers
	}
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		kept, err := s.repo.Lock(ctx, keepID)
		if err != nil {
			return err
		}
		aliases := slices.Clone(kept.Aliases)
		for _, id := range mergeIDs {
			merged, err := s.repo.Lock(ctx, id)
			if err != nil {
				return err
			}
			aliases = append(append(aliases, merged.Name), merged.Aliases...)
			if err := s.repo.Reassign(ctx, id, keepID); err != nil {
				return err
			}
			if err := s.repo.Delete(ctx, id); err != nil {
				return err
			}
		}
		aliases = uniqueByKey(aliases, kept.Name)
		if len(aliases) > MaxAliases {
			aliases = aliases[:MaxAliases]
		}
		return s.repo.Update(ctx, keepID, Changes{Aliases: &aliases})
	})
}

func (s *AdminService) Duplicates(ctx context.Context) ([][]AdminEntry, error) {
	entries, err := s.store.Scan(ctx, duplicateScanSize)
	if err != nil {
		return nil, err
	}
	distinct, err := s.store.Distinctions(ctx)
	if err != nil {
		return nil, err
	}
	return clusters(entries, distinct), nil
}

func (s *AdminService) Dismiss(ctx context.Context, ids []int) error {
	ids = slices.Compact(slices.Sorted(slices.Values(ids)))
	if len(ids) < 2 {
		return ErrMergeNeedsOthers
	}
	var pairs []Distinction
	for i := range ids {
		for j := i + 1; j < len(ids); j++ {
			pairs = append(pairs, distinctionOf(ids[i], ids[j]))
		}
	}
	return s.store.AddDistinctions(ctx, pairs)
}
