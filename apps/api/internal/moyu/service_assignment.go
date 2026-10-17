package moyu

import (
	"context"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type AssignmentService struct {
	assignments Assignments
	patches     Patches
	cache       Cache
}

func NewAssignmentService(assignments Assignments, patches Patches, cache Cache) *AssignmentService {
	return &AssignmentService{assignments: assignments, patches: patches, cache: cache}
}

func (s *AssignmentService) Assignment(ctx context.Context, gameID int) (Assignment, error) {
	game, err := s.assignments.Assigned(ctx, gameID)
	if err != nil {
		return Assignment{}, err
	}
	matched, err := s.matched(ctx, game)
	if err != nil {
		return Assignment{}, err
	}
	assigned := []Page{}
	if game.Assigned && len(game.Pages) > 0 {
		found, err := s.patches.Pages(ctx, PageQuery{IDs: game.Pages})
		if err != nil {
			return Assignment{}, err
		}
		for _, id := range game.Pages {
			if at := slices.IndexFunc(found, func(page Page) bool { return page.ID == id }); at >= 0 {
				assigned = append(assigned, found[at])
			}
		}
	}
	return Assignment{Game: game, Matched: matched, Assigned: assigned}, nil
}

func (s *AssignmentService) matched(ctx context.Context, game Game) ([]Page, error) {
	via := map[string]Anchor{}
	works := []string{}
	for _, anchor := range game.Anchors {
		found, err := worksOf(ctx, s.cache, s.patches, []Anchor{anchor})
		if err != nil {
			return nil, err
		}
		for _, work := range found {
			if _, seen := via[work]; !seen {
				via[work] = anchor
				works = append(works, work)
			}
		}
	}
	vndbID := game.VNDBID()
	if vndbID == "" && len(works) == 0 {
		return []Page{}, nil
	}
	pages, err := s.patches.Pages(ctx, PageQuery{VNDBID: vndbID, Works: works})
	if err != nil {
		return nil, err
	}
	for i, page := range pages {
		if vndbID != "" && page.VNDBID == vndbID {
			pages[i].Via = &Anchor{Source: SourceVNDB, ID: vndbID}
		} else if anchor, ok := via[page.WorkID]; ok {
			pages[i].Via = &anchor
		}
	}
	return listed(pages), nil
}

func (s *AssignmentService) Assign(ctx context.Context, by actor.Actor, gameID int, manual bool, pages []string) error {
	if _, err := s.assignments.Assigned(ctx, gameID); err != nil {
		return err
	}
	if !manual {
		return s.settle(ctx, gameID, s.assignments.Unassign(ctx, gameID))
	}
	unique := []string{}
	for _, id := range pages {
		if !IsPageID(id) {
			return ErrPageNotFound.New()
		}
		if !slices.Contains(unique, id) {
			unique = append(unique, id)
		}
	}
	if len(unique) > 0 {
		found, err := s.patches.Pages(ctx, PageQuery{IDs: unique})
		if err != nil {
			return err
		}
		for _, id := range unique {
			if !slices.ContainsFunc(found, func(page Page) bool { return page.ID == id }) {
				return ErrPageNotFound.New()
			}
		}
	}
	return s.settle(ctx, gameID, s.assignments.Assign(ctx, gameID, unique, by.UserID))
}

func (s *AssignmentService) settle(ctx context.Context, gameID int, err error) error {
	if err != nil {
		return err
	}
	_ = s.cache.Delete(ctx, entriesKey(gameID))
	return nil
}

func (s *AssignmentService) Lookup(ctx context.Context, address string) (Page, error) {
	parsed, ok := ParseAddress(address)
	if !ok {
		return Page{}, ErrAddressUnrecognized.New()
	}
	pageID := parsed.Page
	if parsed.Resource != "" {
		id, found, err := s.patches.PageOfResource(ctx, parsed.Resource)
		if err != nil {
			return Page{}, err
		}
		if !found {
			return Page{}, ErrPageNotFound.New()
		}
		pageID = id
	}
	pages, err := s.patches.Pages(ctx, PageQuery{IDs: []string{pageID}})
	if err != nil {
		return Page{}, err
	}
	if len(pages) == 0 {
		return Page{}, ErrPageNotFound.New()
	}
	return pages[0], nil
}
