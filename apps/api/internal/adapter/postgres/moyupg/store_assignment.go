package moyupg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/patchpageassignment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type AssignmentStore struct {
	games *GameStore
}

func NewAssignmentStore(client *ent.Client) *AssignmentStore {
	return &AssignmentStore{games: NewGameStore(client)}
}

func (s *AssignmentStore) Assigned(ctx context.Context, gameID int) (moyu.Game, error) {
	return s.games.game(ctx, gameID)
}

func (s *AssignmentStore) Assign(ctx context.Context, gameID int, pages []string, by int) error {
	create := postgres.Client(ctx, s.games.client).PatchPageAssignment.Create().
		SetGameID(gameID).
		SetPageIds(pgvalue.Strings(append([]string{}, pages...)))
	if by > 0 {
		create.SetAssignedBy(by)
	}
	if err := create.OnConflictColumns(patchpageassignment.FieldGameID).UpdateNewValues().Exec(ctx); err != nil {
		return fmt.Errorf("assign patch pages to game %d: %w", gameID, err)
	}
	return nil
}

func (s *AssignmentStore) Unassign(ctx context.Context, gameID int) error {
	if _, err := postgres.Client(ctx, s.games.client).PatchPageAssignment.Delete().Where(patchpageassignment.GameID(gameID)).Exec(ctx); err != nil {
		return fmt.Errorf("unassign the patch pages of game %d: %w", gameID, err)
	}
	return nil
}
