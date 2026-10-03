package commenttest

import (
	"testing"
	"time"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(t *testing.T) Env {
		clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		repo := NewMemoryRepository(func() time.Time {
			clock = clock.Add(time.Second)
			return clock
		})
		users, games := 0, 0
		return Env{
			Repo:    repo,
			NewUser: func(*testing.T) int { users++; return users },
			NewGame: func(*testing.T) int {
				games++
				repo.AddGame(games, false)
				return games
			},
			NewRatedGame: func(*testing.T) int {
				games++
				repo.AddGame(games, true)
				return games
			},
		}
	})
}
