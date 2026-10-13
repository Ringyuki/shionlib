package messagetest

import (
	"testing"
	"time"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		users, games := 0, 0
		return Env{
			Repo: NewMemoryRepository(func() time.Time {
				clock = clock.Add(time.Second)
				return clock
			}),
			NewUser: func(*testing.T) int { users++; return users },
			NewGame: func(*testing.T) int { games++; return games },
		}
	})
}
