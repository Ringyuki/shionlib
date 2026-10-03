package favorite

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Repository interface {
	Get(ctx context.Context, id int) (Favorite, error)
	Lock(ctx context.Context, id int) (Favorite, error)
	FindByName(ctx context.Context, userID int, name string) (Favorite, bool, error)
	Create(ctx context.Context, in NewFavorite) (Favorite, error)
	Update(ctx context.Context, id int, changes Changes) error
	Delete(ctx context.Context, id int) error
	List(ctx context.Context, filter ListFilter) ([]Summary, error)
	GetItem(ctx context.Context, id int) (Item, error)
	FindItem(ctx context.Context, favoriteID, gameID int) (Item, bool, error)
	CreateItem(ctx context.Context, in NewItem) error
	UpdateItemNote(ctx context.Context, id int, note string) error
	DeleteItem(ctx context.Context, id int) error
	ListItems(ctx context.Context, favoriteID int, page Page) ([]Item, int, error)
	HasGame(ctx context.Context, userID, gameID int) (bool, error)
}

type GameCards interface {
	Exists(ctx context.Context, id int) (bool, error)
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
