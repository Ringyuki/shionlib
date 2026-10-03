package favoritehttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type favoritePathInput struct {
	ID int `path:"id" minimum:"1"`
}

type favoriteItemPathInput struct {
	ItemID int `path:"item_id" minimum:"1"`
}

type createFavoriteInput struct {
	Body struct {
		Name        string  `json:"name" minLength:"1" maxLength:"255"`
		Description *string `json:"description,omitempty" maxLength:"2000"`
		IsPrivate   bool    `json:"is_private"`
	}
}

type updateFavoriteInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Name        *string `json:"name,omitempty" maxLength:"255"`
		Description *string `json:"description,omitempty" maxLength:"2000"`
		IsPrivate   *bool   `json:"is_private,omitempty"`
	}
}

type addFavoriteGameInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		GameID int     `json:"game_id" minimum:"1"`
		Note   *string `json:"note,omitempty" maxLength:"2000"`
	}
}

type updateFavoriteItemInput struct {
	ItemID int `path:"item_id" minimum:"1"`
	Body   struct {
		Note *string `json:"note,omitempty" maxLength:"2000"`
	}
}

type removeFavoriteGameInput struct {
	ID     int `path:"id" minimum:"1"`
	GameID int `path:"game_id" minimum:"1"`
}

type listFavoritesInput struct {
	UserID int `query:"user_id" minimum:"0" doc:"Owner whose lists to show; defaults to the caller"`
	GameID int `query:"game_id" minimum:"0" doc:"When set, every list reports whether it contains this game"`
}

func (in *listFavoritesInput) userID() *int {
	if in.UserID <= 0 {
		return nil
	}
	return &in.UserID
}

func (in *listFavoritesInput) gameID() *int {
	if in.GameID <= 0 {
		return nil
	}
	return &in.GameID
}

type favoriteItemsInput struct {
	ID int `path:"id" minimum:"1"`
	httpapi.PageQuery
}
