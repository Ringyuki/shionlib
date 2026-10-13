package inspection

import (
	"context"
	"errors"
)

type MediumService struct {
	repo Repository
}

func NewMediumService(repo Repository) *MediumService {
	return &MediumService{repo: repo}
}

func (s *MediumService) Medium(ctx context.Context, inspectionID int) (string, error) {
	found, err := s.repo.Get(ctx, inspectionID)
	if errors.Is(err, ErrNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	names, err := s.repo.MediumNames(ctx, inspectionID)
	if err != nil {
		return "", err
	}
	return Medium(names, found.Archive), nil
}
