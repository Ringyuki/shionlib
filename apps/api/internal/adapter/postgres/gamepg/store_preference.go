package gamepg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
)

type PreferenceStore struct {
	client *ent.Client
}

func NewPreferenceStore(client *ent.Client) *PreferenceStore {
	return &PreferenceStore{client: client}
}

func (p *PreferenceStore) OnlyGamesWithResources(ctx context.Context, userID int) (bool, error) {
	row, err := postgres.Client(ctx, p.client).User.Query().
		Where(user.ID(userID)).
		Select(user.FieldOnlyGamesWithResources).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return true, nil
	}
	if err != nil {
		return false, fmt.Errorf("read resource preference of user %d: %w", userID, err)
	}
	return row.OnlyGamesWithResources, nil
}
