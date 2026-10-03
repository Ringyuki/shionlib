package favoritepg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
)

func toFavorite(row *ent.Favorite) favorite.Favorite {
	return favorite.Favorite{
		ID:          row.ID,
		UserID:      row.UserID,
		Name:        row.Name,
		Description: row.Description,
		IsPrivate:   row.IsPrivate,
		Default:     row.Default,
		Created:     row.Created,
		Updated:     row.Updated,
	}
}

func toItem(row *ent.FavoriteItem) favorite.Item {
	item := favorite.Item{
		ID:         row.ID,
		FavoriteID: row.FavoriteID,
		GameID:     row.GameID,
		Note:       row.Note,
		Created:    row.Created,
	}
	if owner := row.Edges.Favorite; owner != nil {
		item.OwnerID = owner.UserID
	}
	return item
}
