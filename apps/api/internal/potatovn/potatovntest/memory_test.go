package potatovntest

import (
	"testing"
	"time"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(t *testing.T) Env {
		repo := NewMemoryRepository(func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) })
		users, games := 0, 0
		return Env{
			Repo:    repo,
			Catalog: repo,
			NewUser: func(*testing.T) int { users++; return users },
			NewGame: func(_ *testing.T, fixture GameFixture) int {
				games++
				repo.AddGame(InfoFrom(games, fixture))
				return games
			},
		}
	})
}
