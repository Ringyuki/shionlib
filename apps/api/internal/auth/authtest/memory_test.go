package authtest

import (
	"testing"
	"time"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(t *testing.T) Env {
		users := 0
		return Env{
			Repo:    NewMemoryRepository(func() time.Time { return time.Now().UTC() }),
			NewUser: func(*testing.T) int { users++; return users },
		}
	})
}
