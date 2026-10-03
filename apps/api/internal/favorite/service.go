package favorite

import (
	"context"
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Service struct {
	repo  Repository
	games GameCards
	tx    Transactor
}

func NewService(repo Repository, games GameCards, tx Transactor) *Service {
	return &Service{repo: repo, games: games, tx: tx}
}

func (s *Service) Create(ctx context.Context, who actor.Actor, in CreateInput) (Favorite, error) {
	if _, found, err := s.repo.FindByName(ctx, who.UserID, in.Name); err != nil {
		return Favorite{}, err
	} else if found {
		return Favorite{}, ErrAlreadyExists
	}
	return s.repo.Create(ctx, NewFavorite{
		UserID:      who.UserID,
		Name:        in.Name,
		Description: in.Description,
		IsPrivate:   in.IsPrivate,
	})
}

func (s *Service) Update(ctx context.Context, who actor.Actor, id int, changes Changes) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.owned(ctx, who, id); err != nil {
			return err
		}
		if changes.Name != nil {
			existing, found, err := s.repo.FindByName(ctx, who.UserID, *changes.Name)
			if err != nil {
				return err
			}
			if found && existing.ID != id {
				return ErrNameAlreadyExists
			}
		}
		return s.repo.Update(ctx, id, changes)
	})
}

func (s *Service) Delete(ctx context.Context, who actor.Actor, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		fav, err := s.owned(ctx, who, id)
		if err != nil {
			return err
		}
		if fav.Default {
			return ErrDefaultNotAllowDelete
		}
		return s.repo.Delete(ctx, id)
	})
}

func (s *Service) AddGame(ctx context.Context, who actor.Actor, favoriteID, gameID int, note *string) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.owned(ctx, who, favoriteID); err != nil {
			return err
		}
		exists, err := s.games.Exists(ctx, gameID)
		if err != nil {
			return err
		}
		if !exists {
			return game.ErrNotFound
		}
		if _, found, err := s.repo.FindItem(ctx, favoriteID, gameID); err != nil {
			return err
		} else if found {
			return ErrItemAlreadyExists
		}
		return s.repo.CreateItem(ctx, NewItem{FavoriteID: favoriteID, GameID: gameID, Note: note})
	})
}

func (s *Service) UpdateItem(ctx context.Context, who actor.Actor, itemID int, note *string) error {
	if _, err := s.ownedItem(ctx, who, itemID); err != nil {
		return err
	}
	if note == nil {
		return nil
	}
	return s.repo.UpdateItemNote(ctx, itemID, *note)
}

func (s *Service) DeleteItem(ctx context.Context, who actor.Actor, itemID int) error {
	if _, err := s.ownedItem(ctx, who, itemID); err != nil {
		return err
	}
	return s.repo.DeleteItem(ctx, itemID)
}

func (s *Service) RemoveGame(ctx context.Context, who actor.Actor, favoriteID, gameID int) error {
	fav, err := s.repo.Get(ctx, favoriteID)
	if errors.Is(err, ErrNotFound) {
		return ErrItemNotFound
	}
	if err != nil {
		return err
	}
	if fav.UserID != who.UserID {
		return ErrItemNotOwner
	}
	item, found, err := s.repo.FindItem(ctx, favoriteID, gameID)
	if err != nil {
		return err
	}
	if !found {
		return ErrItemNotFound
	}
	return s.repo.DeleteItem(ctx, item.ID)
}

func (s *Service) List(ctx context.Context, viewer actor.Actor, query ListQuery) ([]Summary, error) {
	if query.GameID != nil && !viewer.Authenticated() {
		return nil, auth.ErrUnauthorized
	}
	ownerID := viewer.UserID
	if query.UserID != nil && *query.UserID > 0 {
		ownerID = *query.UserID
	}
	if ownerID <= 0 {
		return []Summary{}, nil
	}
	return s.repo.List(ctx, ListFilter{
		OwnerID:     ownerID,
		PublicOnly:  ownerID != viewer.UserID,
		ContainGame: query.GameID,
	})
}

func (s *Service) Items(ctx context.Context, viewer actor.Actor, favoriteID int, page Page) ([]ItemView, int, error) {
	fav, err := s.repo.Get(ctx, favoriteID)
	if err != nil {
		return nil, 0, err
	}
	if fav.IsPrivate && fav.UserID != viewer.UserID {
		return nil, 0, ErrNotAllowView
	}
	items, total, err := s.repo.ListItems(ctx, favoriteID, page)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int, len(items))
	for i, item := range items {
		ids[i] = item.GameID
	}
	cards, err := s.games.ByIDs(ctx, ids, viewer)
	if err != nil {
		return nil, 0, err
	}
	views := make([]ItemView, len(items))
	for i, item := range items {
		card, ok := cards[item.GameID]
		if !ok {
			card = game.Card{ID: item.GameID}
		}
		views[i] = ItemView{ID: item.ID, Note: item.Note, Game: card}
	}
	return views, total, nil
}

func (s *Service) HasGame(ctx context.Context, who actor.Actor, gameID int) (bool, error) {
	return s.repo.HasGame(ctx, who.UserID, gameID)
}

func (s *Service) owned(ctx context.Context, who actor.Actor, id int) (Favorite, error) {
	fav, err := s.repo.Lock(ctx, id)
	if err != nil {
		return Favorite{}, err
	}
	if fav.UserID != who.UserID {
		return Favorite{}, ErrNotOwner
	}
	return fav, nil
}

func (s *Service) ownedItem(ctx context.Context, who actor.Actor, id int) (Item, error) {
	item, err := s.repo.GetItem(ctx, id)
	if err != nil {
		return Item{}, err
	}
	if item.OwnerID != who.UserID {
		return Item{}, ErrItemNotOwner
	}
	return item, nil
}
