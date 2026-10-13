package adtest

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
		users := 0
		return Env{
			Repo:       repo,
			Sponsors:   repo,
			NewUser:    func(*testing.T) int { users++; return users },
			SetSponsor: func(_ *testing.T, id int, until time.Time) { repo.SetSponsor(id, until) },
		}
	})
}
