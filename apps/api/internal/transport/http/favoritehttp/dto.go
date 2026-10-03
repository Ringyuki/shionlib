package favoritehttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type favoritePath struct {
	ID int `path:"id" minimum:"1"`
}

type favoriteItemPath struct {
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

type favoriteDTO struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsPrivate   bool    `json:"is_private"`
}

type favoriteSummaryDTO struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsPrivate   bool    `json:"is_private"`
	Default     bool    `json:"default"`
	GameCount   int     `json:"game_count"`
	IsFavorite  *bool   `json:"is_favorite,omitempty"`
}

type favoriteItemDTO struct {
	ID   int               `json:"id"`
	Note *string           `json:"note"`
	Game gamehttp.GameCard `json:"game"`
}

type favoriteItemPageMeta struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type favoriteItemPageDTO struct {
	Items []favoriteItemDTO    `json:"items"`
	Meta  favoriteItemPageMeta `json:"meta"`
}

type favoriteGameStatsDTO struct {
	IsFavorite bool `json:"is_favorite"`
}

func toFavoriteDTO(f favorite.Favorite) favoriteDTO {
	return favoriteDTO{ID: f.ID, Name: f.Name, Description: f.Description, IsPrivate: f.IsPrivate}
}

func toFavoriteSummaryDTO(s favorite.Summary) favoriteSummaryDTO {
	return favoriteSummaryDTO{
		ID:          s.ID,
		Name:        s.Name,
		Description: s.Description,
		IsPrivate:   s.IsPrivate,
		Default:     s.Default,
		GameCount:   s.GameCount,
		IsFavorite:  s.IsFavorite,
	}
}
