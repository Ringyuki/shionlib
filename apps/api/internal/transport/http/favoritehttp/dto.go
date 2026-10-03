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

type itemPath struct {
	ItemID int `path:"item_id" minimum:"1"`
}

type createInput struct {
	Body struct {
		Name        string  `json:"name" minLength:"1" maxLength:"255"`
		Description *string `json:"description,omitempty" maxLength:"2000"`
		IsPrivate   bool    `json:"is_private"`
	}
}

type updateInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Name        *string `json:"name,omitempty" maxLength:"255"`
		Description *string `json:"description,omitempty" maxLength:"2000"`
		IsPrivate   *bool   `json:"is_private,omitempty"`
	}
}

type addGameInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		GameID int     `json:"game_id" minimum:"1"`
		Note   *string `json:"note,omitempty" maxLength:"2000"`
	}
}

type updateItemInput struct {
	ItemID int `path:"item_id" minimum:"1"`
	Body   struct {
		Note *string `json:"note,omitempty" maxLength:"2000"`
	}
}

type removeGameInput struct {
	ID     int `path:"id" minimum:"1"`
	GameID int `path:"game_id" minimum:"1"`
}

type listInput struct {
	UserID int `query:"user_id" minimum:"0" doc:"Owner whose lists to show; defaults to the caller"`
	GameID int `query:"game_id" minimum:"0" doc:"When set, every list reports whether it contains this game"`
}

func (in *listInput) userID() *int {
	if in.UserID <= 0 {
		return nil
	}
	return &in.UserID
}

func (in *listInput) gameID() *int {
	if in.GameID <= 0 {
		return nil
	}
	return &in.GameID
}

type itemsInput struct {
	ID int `path:"id" minimum:"1"`
	httpapi.PageQuery
}

type favoriteDTO struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsPrivate   bool    `json:"is_private"`
}

type summaryDTO struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsPrivate   bool    `json:"is_private"`
	Default     bool    `json:"default"`
	GameCount   int     `json:"game_count"`
	IsFavorite  *bool   `json:"is_favorite,omitempty"`
}

type itemDTO struct {
	ID   int           `json:"id"`
	Note *string       `json:"note"`
	Game gamehttp.Card `json:"game"`
}

type itemPageMeta struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type itemPageDTO struct {
	Items []itemDTO    `json:"items"`
	Meta  itemPageMeta `json:"meta"`
}

type gameStatsDTO struct {
	IsFavorite bool `json:"is_favorite"`
}

func toFavoriteDTO(f favorite.Favorite) favoriteDTO {
	return favoriteDTO{ID: f.ID, Name: f.Name, Description: f.Description, IsPrivate: f.IsPrivate}
}

func toSummaryDTO(s favorite.Summary) summaryDTO {
	return summaryDTO{
		ID:          s.ID,
		Name:        s.Name,
		Description: s.Description,
		IsPrivate:   s.IsPrivate,
		Default:     s.Default,
		GameCount:   s.GameCount,
		IsFavorite:  s.IsFavorite,
	}
}
