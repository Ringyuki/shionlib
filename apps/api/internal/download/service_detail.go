package download

import (
	"context"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type DetailService struct {
	repo     Repository
	games    GameCards
	comments Discussions
	settings setting.Source
}

func NewDetailService(repo Repository, games GameCards, comments Discussions, settings setting.Source) *DetailService {
	return &DetailService{repo: repo, games: games, comments: comments, settings: settings}
}

func (s *DetailService) Detail(ctx context.Context, viewer actor.Actor, id int) (ResourceDetail, error) {
	resource, err := s.visibleResource(ctx, viewer, id)
	if err != nil {
		return ResourceDetail{}, err
	}
	cards, err := s.games.ByIDs(ctx, []int{resource.GameID}, viewer)
	if err != nil {
		return ResourceDetail{}, err
	}
	counted := []GameResource{resource}
	if err := countComments(ctx, s.comments, counted); err != nil {
		return ResourceDetail{}, err
	}
	return ResourceDetail{GameResource: counted[0], Game: cardOrStub(cards, resource.GameID)}, nil
}

func (s *DetailService) Events(ctx context.Context, viewer actor.Actor, id int) ([]Event, error) {
	if _, err := s.visibleResource(ctx, viewer, id); err != nil {
		return nil, err
	}
	return s.repo.ListEvents(ctx, id, EventListLimit)
}

func (s *DetailService) Inspections(ctx context.Context, viewer actor.Actor, id int) ([]int, error) {
	resource, err := s.visibleResource(ctx, viewer, id)
	if err != nil {
		return nil, err
	}
	ids := []int{}
	for _, file := range resource.Files {
		if file.InspectionID != nil && !slices.Contains(ids, *file.InspectionID) {
			ids = append(ids, *file.InspectionID)
		}
	}
	return ids, nil
}

func (s *DetailService) Viewable(ctx context.Context, viewer actor.Actor, id int) (Resource, error) {
	resource, err := s.visibleResource(ctx, viewer, id)
	if err != nil {
		return Resource{}, err
	}
	return resource.Resource, nil
}

func (s *DetailService) visibleResource(ctx context.Context, viewer actor.Actor, id int) (GameResource, error) {
	resource, err := s.repo.GetGameResource(ctx, id)
	if err != nil {
		return GameResource{}, err
	}
	oversees := viewer.AtLeast(actor.RoleAdmin)
	if resource.Status != ResourceActive || (!oversees && !resource.VisibleTo(viewer.UserID)) {
		return GameResource{}, ErrResourceNotFound
	}
	resource.Files = slices.DeleteFunc(resource.Files, func(f GameFile) bool {
		return f.Status != FileInObjectStore && f.CreatorID != viewer.UserID && !oversees
	})
	if len(resource.Files) == 0 && !oversees && resource.CreatorID != viewer.UserID {
		return GameResource{}, ErrResourceNotFound
	}
	resource.Awaited = resource.awaiting(IncompleteSetTimeout.Read(s.settings))
	return resource, nil
}
