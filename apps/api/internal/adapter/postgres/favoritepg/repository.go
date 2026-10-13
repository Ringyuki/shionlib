package favoritepg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entfavorite "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/favoriteitem"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const (
	uniqueFavoriteName = "favorites_user_id_name_key"
	uniqueItem         = "favorite_items_favorite_id_game_id_key"
	itemFavoriteFK     = "favorite_items_favorite_id_fkey"
	itemGameFK         = "favorite_items_game_id_fkey"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Get(ctx context.Context, id int) (favorite.Favorite, error) {
	row, err := r.db(ctx).Favorite.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return favorite.Favorite{}, favorite.ErrNotFound
	}
	if err != nil {
		return favorite.Favorite{}, fmt.Errorf("get favorite %d: %w", id, err)
	}
	return toFavorite(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (favorite.Favorite, error) {
	row, err := r.db(ctx).Favorite.Query().Where(entfavorite.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return favorite.Favorite{}, favorite.ErrNotFound
	}
	if err != nil {
		return favorite.Favorite{}, fmt.Errorf("lock favorite %d: %w", id, err)
	}
	return toFavorite(row), nil
}

func (r *Repository) FindByName(ctx context.Context, userID int, name string) (favorite.Favorite, bool, error) {
	row, err := r.db(ctx).Favorite.Query().Where(entfavorite.UserID(userID), entfavorite.Name(name)).Only(ctx)
	if postgres.IsNotFound(err) {
		return favorite.Favorite{}, false, nil
	}
	if err != nil {
		return favorite.Favorite{}, false, fmt.Errorf("find favorite by name: %w", err)
	}
	return toFavorite(row), true, nil
}

func (r *Repository) Create(ctx context.Context, in favorite.NewFavorite) (favorite.Favorite, error) {
	row, err := r.db(ctx).Favorite.Create().
		SetUserID(in.UserID).
		SetName(in.Name).
		SetNillableDescription(in.Description).
		SetIsPrivate(in.IsPrivate).
		Save(ctx)
	if postgres.IsUniqueViolation(err, uniqueFavoriteName) {
		return favorite.Favorite{}, favorite.ErrAlreadyExists
	}
	if err != nil {
		return favorite.Favorite{}, fmt.Errorf("create favorite: %w", err)
	}
	return toFavorite(row), nil
}

func (r *Repository) Update(ctx context.Context, id int, changes favorite.Changes) error {
	update := r.db(ctx).Favorite.UpdateOneID(id)
	if changes.Name != nil {
		update.SetName(*changes.Name)
	}
	if changes.Description != nil {
		update.SetDescription(*changes.Description)
	}
	if changes.IsPrivate != nil {
		update.SetIsPrivate(*changes.IsPrivate)
	}
	err := update.Exec(ctx)
	switch {
	case postgres.IsNotFound(err):
		return favorite.ErrNotFound
	case postgres.IsUniqueViolation(err, uniqueFavoriteName):
		return favorite.ErrNameAlreadyExists
	case err != nil:
		return fmt.Errorf("update favorite %d: %w", id, err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).Favorite.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return favorite.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete favorite %d: %w", id, err)
	}
	return nil
}

func (r *Repository) List(ctx context.Context, filter favorite.ListFilter) ([]favorite.Summary, error) {
	query := r.db(ctx).Favorite.Query().Where(entfavorite.UserID(filter.OwnerID))
	if filter.PublicOnly {
		query.Where(entfavorite.IsPrivate(false))
	}
	rows, err := query.Order(ent.Desc(entfavorite.FieldDefault), ent.Asc(entfavorite.FieldID)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list favorites: %w", err)
	}
	summaries := make([]favorite.Summary, 0, len(rows))
	if len(rows) == 0 {
		return summaries, nil
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	var counts []struct {
		FavoriteID int `json:"favorite_id"`
		Count      int `json:"count"`
	}
	err = r.db(ctx).FavoriteItem.Query().
		Where(favoriteitem.FavoriteIDIn(ids...)).
		GroupBy(favoriteitem.FieldFavoriteID).
		Aggregate(ent.Count()).
		Scan(ctx, &counts)
	if err != nil {
		return nil, fmt.Errorf("count favorite items: %w", err)
	}
	countByID := make(map[int]int, len(counts))
	for _, c := range counts {
		countByID[c.FavoriteID] = c.Count
	}
	containing := map[int]bool{}
	if filter.ContainGame != nil {
		matched, err := r.db(ctx).FavoriteItem.Query().
			Where(favoriteitem.FavoriteIDIn(ids...), favoriteitem.GameID(*filter.ContainGame)).
			Select(favoriteitem.FieldFavoriteID).
			Ints(ctx)
		if err != nil {
			return nil, fmt.Errorf("find favorites containing game: %w", err)
		}
		for _, id := range matched {
			containing[id] = true
		}
	}
	for _, row := range rows {
		summary := favorite.Summary{Favorite: toFavorite(row), GameCount: countByID[row.ID]}
		if filter.ContainGame != nil {
			contains := containing[row.ID]
			summary.IsFavorite = &contains
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func (r *Repository) GetItem(ctx context.Context, id int) (favorite.Item, error) {
	row, err := r.db(ctx).FavoriteItem.Query().Where(favoriteitem.ID(id)).WithFavorite().Only(ctx)
	if postgres.IsNotFound(err) {
		return favorite.Item{}, favorite.ErrItemNotFound
	}
	if err != nil {
		return favorite.Item{}, fmt.Errorf("get favorite item %d: %w", id, err)
	}
	return toItem(row), nil
}

func (r *Repository) FindItem(ctx context.Context, favoriteID, gameID int) (favorite.Item, bool, error) {
	row, err := r.db(ctx).FavoriteItem.Query().
		Where(favoriteitem.FavoriteID(favoriteID), favoriteitem.GameID(gameID)).
		WithFavorite().
		Only(ctx)
	if postgres.IsNotFound(err) {
		return favorite.Item{}, false, nil
	}
	if err != nil {
		return favorite.Item{}, false, fmt.Errorf("find favorite item: %w", err)
	}
	return toItem(row), true, nil
}

func (r *Repository) CreateItem(ctx context.Context, in favorite.NewItem) error {
	err := r.db(ctx).FavoriteItem.Create().
		SetFavoriteID(in.FavoriteID).
		SetGameID(in.GameID).
		SetNillableNote(in.Note).
		Exec(ctx)
	switch {
	case postgres.IsUniqueViolation(err, uniqueItem):
		return favorite.ErrItemAlreadyExists
	case postgres.IsForeignKeyViolation(err, itemFavoriteFK):
		return favorite.ErrNotFound
	case postgres.IsForeignKeyViolation(err, itemGameFK):
		return game.ErrNotFound
	case err != nil:
		return fmt.Errorf("create favorite item: %w", err)
	}
	return nil
}

func (r *Repository) UpdateItemNote(ctx context.Context, id int, note string) error {
	err := r.db(ctx).FavoriteItem.UpdateOneID(id).SetNote(note).Exec(ctx)
	if postgres.IsNotFound(err) {
		return favorite.ErrItemNotFound
	}
	if err != nil {
		return fmt.Errorf("update favorite item %d: %w", id, err)
	}
	return nil
}

func (r *Repository) DeleteItem(ctx context.Context, id int) error {
	err := r.db(ctx).FavoriteItem.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return favorite.ErrItemNotFound
	}
	if err != nil {
		return fmt.Errorf("delete favorite item %d: %w", id, err)
	}
	return nil
}

func (r *Repository) ListItems(ctx context.Context, favoriteID int, page favorite.Page) ([]favorite.Item, int, error) {
	query := r.db(ctx).FavoriteItem.Query().Where(favoriteitem.FavoriteID(favoriteID))
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count favorite items: %w", err)
	}
	rows, err := query.
		WithFavorite().
		Order(ent.Desc(favoriteitem.FieldCreated), ent.Desc(favoriteitem.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list favorite items: %w", err)
	}
	items := make([]favorite.Item, len(rows))
	for i, row := range rows {
		items[i] = toItem(row)
	}
	return items, total, nil
}

func (r *Repository) HasGame(ctx context.Context, userID, gameID int) (bool, error) {
	exists, err := r.db(ctx).FavoriteItem.Query().
		Where(favoriteitem.GameID(gameID), favoriteitem.HasFavoriteWith(entfavorite.UserID(userID))).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check favorited game: %w", err)
	}
	return exists, nil
}
