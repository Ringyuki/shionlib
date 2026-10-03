package favoritehttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type favoriteItemPageMetaDTO struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
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
	ID   int                  `json:"id"`
	Note *string              `json:"note"`
	Game gamehttp.GameCardDTO `json:"game"`
}

type favoriteItemPageDTO struct {
	Items []favoriteItemDTO       `json:"items"`
	Meta  favoriteItemPageMetaDTO `json:"meta"`
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
