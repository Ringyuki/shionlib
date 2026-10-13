package authpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

type StandingStore struct {
	client *ent.Client
}

func NewStandingStore(client *ent.Client) *StandingStore {
	return &StandingStore{client: client}
}

func (s *StandingStore) Standing(ctx context.Context, userID int) (auth.Standing, bool, error) {
	row, err := postgres.Client(ctx, s.client).User.Query().
		Where(user.ID(userID)).
		Select(user.FieldRole, user.FieldContentLimit).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return auth.Standing{}, false, nil
	}
	if err != nil {
		return auth.Standing{}, false, fmt.Errorf("read standing of user %d: %w", userID, err)
	}
	return auth.Standing{Role: actor.Role(row.Role), ContentLimit: actor.ContentLimit(row.ContentLimit)}, true, nil
}
