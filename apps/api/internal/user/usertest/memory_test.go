package usertest

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
		return Env{
			Repo:               repo,
			HasDefaultFavorite: func(_ *testing.T, id int) bool { return repo.HasDefaultFavorite(id) },
			HasQuota:           func(_ *testing.T, id int) bool { return repo.HasQuota(id) },
		}
	})
}
