package character

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

func (s *Service) List(ctx context.Context, query string, page Page) ([]Character, int, error) {
	return s.repo.List(ctx, strings.TrimSpace(query), page)
}

func (s *Service) Get(ctx context.Context, id int) (Character, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id int) (Character, error) {
	var deleted Character
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		found, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		linked, err := s.repo.HasRelations(ctx, id)
		if err != nil {
			return err
		}
		if linked {
			return ErrHasRelations
		}
		if err := s.repo.Delete(ctx, id); err != nil {
			return err
		}
		deleted = found
		return nil
	})
	return deleted, err
}
