package walkthrough

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type AdminService struct {
	repo  Repository
	store AdminStore
	queue Queue
	tx    Transactor
}

func NewAdminService(repo Repository, store AdminStore, queue Queue, tx Transactor) *AdminService {
	return &AdminService{repo: repo, store: store, queue: queue, tx: tx}
}

func (s *AdminService) Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error) {
	return s.store.Search(ctx, filter, page)
}

func (s *AdminService) Detail(ctx context.Context, id int) (AdminDetail, error) {
	return s.store.Detail(ctx, id)
}

func (s *AdminService) SetStatus(ctx context.Context, id int, status Status) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		existing, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		if existing.Status == status {
			return nil
		}
		return s.repo.SetStatus(ctx, id, status)
	})
}

func (s *AdminService) Rescan(ctx context.Context, id int) error {
	existing, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}
	if existing.Status == StatusDeleted {
		return ErrNotFound
	}
	return s.queue.Enqueue(ctx, moderation.ReviewWalkthrough{WalkthroughID: id})
}
