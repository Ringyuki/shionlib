package open

import "context"

type Service struct {
	games     Games
	resources Resources
}

func NewService(games Games, resources Resources) *Service {
	return &Service{games: games, resources: resources}
}

func (s *Service) Lookup(ctx context.Context, kind Kind, raw string) (Result, error) {
	values, err := parse(kind, raw)
	if err != nil {
		return Result{}, err
	}
	canonical := make([]string, len(values))
	for i, v := range values {
		canonical[i] = v.canonical
	}
	found, err := s.games.Find(ctx, kind, canonical)
	if err != nil {
		return Result{}, err
	}
	result := Result{Games: []Game{}, Missing: []string{}}
	taken := map[int]bool{}
	for _, v := range values {
		matched := matching(found, kind, v.canonical)
		if len(matched) == 0 {
			result.Missing = append(result.Missing, v.given)
		}
		for _, game := range matched {
			if !taken[game.ID] {
				taken[game.ID] = true
				result.Games = append(result.Games, game)
			}
		}
	}
	ids := make([]int, len(result.Games))
	for i, game := range result.Games {
		ids[i] = game.ID
	}
	resources, err := s.resources.PublicResources(ctx, ids)
	if err != nil {
		return Result{}, err
	}
	for i := range result.Games {
		result.Games[i].Resources = resources[result.Games[i].ID]
	}
	return result, nil
}
