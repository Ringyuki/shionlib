package friendlink

import (
	"context"
	"strings"
)

type Service struct {
	repo Repository
	tx   Transactor
}

func NewService(repo Repository, tx Transactor) *Service {
	return &Service{repo: repo, tx: tx}
}

func (s *Service) Visible(ctx context.Context) ([]Link, error) {
	return s.repo.List(ctx, true)
}

func (s *Service) List(ctx context.Context) ([]Link, error) {
	return s.repo.List(ctx, false)
}

func (s *Service) Create(ctx context.Context, in NewLink) (Link, error) {
	in.Name, in.URL, in.Description = strings.TrimSpace(in.Name), strings.TrimSpace(in.URL), strings.TrimSpace(in.Description)
	var created Link
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		last, err := s.repo.LastPosition(ctx)
		if err != nil {
			return err
		}
		created, err = s.repo.Create(ctx, in, last+1)
		return err
	})
	return created, err
}

func (s *Service) Update(ctx context.Context, id int, changes Changes) (Link, error) {
	changes.Name, changes.URL, changes.Description = trimmed(changes.Name), trimmed(changes.URL), trimmed(changes.Description)
	return s.repo.Update(ctx, id, changes)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) Reorder(ctx context.Context, ids []int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		links, err := s.repo.List(ctx, false)
		if err != nil {
			return err
		}
		if !sameLinks(links, ids) {
			return ErrStaleOrder
		}
		for i, id := range ids {
			if err := s.repo.SetPosition(ctx, id, i+1); err != nil {
				return err
			}
		}
		return nil
	})
}

func sameLinks(links []Link, ids []int) bool {
	if len(links) != len(ids) {
		return false
	}
	given := make(map[int]bool, len(ids))
	for _, id := range ids {
		given[id] = true
	}
	for _, link := range links {
		if !given[link.ID] {
			return false
		}
	}
	return len(given) == len(ids)
}

func trimmed(value *string) *string {
	if value == nil {
		return nil
	}
	out := strings.TrimSpace(*value)
	return &out
}
