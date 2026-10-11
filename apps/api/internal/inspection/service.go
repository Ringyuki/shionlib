package inspection

import (
	"context"
	"slices"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

type Service struct {
	repo      Repository
	resources Resources
}

func NewService(repo Repository, resources Resources) *Service {
	return &Service{repo: repo, resources: resources}
}

func (s *Service) OfResource(ctx context.Context, viewer actor.Actor, resourceID int) ([]View, error) {
	ids, err := s.resources.Inspections(ctx, viewer, resourceID)
	if err != nil || len(ids) == 0 {
		return []View{}, err
	}
	found, err := s.repo.ByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	discs, err := s.repo.Discs(ctx, ids)
	if err != nil {
		return nil, err
	}
	views := make([]View, 0, len(found))
	for _, id := range ids {
		at := slices.IndexFunc(found, func(item Inspection) bool { return item.ID == id })
		if at < 0 {
			continue
		}
		view := View{Inspection: found[at], Discs: []Entry{}}
		for _, disc := range discs {
			if disc.InspectionID == id {
				view.Discs = append(view.Discs, disc)
			}
		}
		views = append(views, view)
	}
	return views, nil
}

func (s *Service) Children(ctx context.Context, viewer actor.Actor, inspectionID int, parentID *int, page Page) ([]Entry, int, error) {
	if err := visible(ctx, s.repo, s.resources, viewer, inspectionID); err != nil {
		return nil, 0, err
	}
	return s.repo.Children(ctx, inspectionID, parentID, page)
}

func (s *Service) Search(ctx context.Context, viewer actor.Actor, inspectionID int, query string, page Page) ([]Found, int, error) {
	if err := visible(ctx, s.repo, s.resources, viewer, inspectionID); err != nil {
		return nil, 0, err
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return []Found{}, 0, nil
	}
	return s.repo.Search(ctx, inspectionID, query, page)
}

func visible(ctx context.Context, repo Repository, resources Resources, viewer actor.Actor, inspectionID int) error {
	found, err := repo.Get(ctx, inspectionID)
	if err != nil {
		return err
	}
	ids, err := resources.Inspections(ctx, viewer, found.ResourceID)
	if failure, known := apperror.From(err); known && failure.Definition().Kind() == apperror.KindNotFound {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if !slices.Contains(ids, inspectionID) {
		return ErrNotFound
	}
	return nil
}
