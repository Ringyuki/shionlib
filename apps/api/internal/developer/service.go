package developer

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

func (s *Service) List(ctx context.Context, query string, page Page) ([]Summary, int, error) {
	return s.repo.List(ctx, strings.TrimSpace(query), page)
}

func (s *Service) Get(ctx context.Context, id int) (Developer, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.repo.Lock(ctx, id); err != nil {
			return err
		}
		linked, err := s.repo.HasRelations(ctx, id)
		if err != nil {
			return err
		}
		if linked {
			return ErrHasRelations
		}
		parent, err := s.repo.HasChildren(ctx, id)
		if err != nil {
			return err
		}
		if parent {
			return ErrHasChildren
		}
		return s.repo.Delete(ctx, id)
	})
}
