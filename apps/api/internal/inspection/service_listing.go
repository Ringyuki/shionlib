package inspection

import (
	"context"
)

type ListingService struct {
	repo Repository
}

func NewListingService(repo Repository) *ListingService {
	return &ListingService{repo: repo}
}

func (s *ListingService) Facts(ctx context.Context, ids []int) (map[int]Inspection, error) {
	found, err := s.repo.ByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	facts := make(map[int]Inspection, len(found))
	for _, inspection := range found {
		facts[inspection.ID] = inspection
	}
	return facts, nil
}

func (s *ListingService) Files(ctx context.Context, inspectionID int) ([]FilePath, error) {
	return s.repo.FilePaths(ctx, inspectionID)
}
