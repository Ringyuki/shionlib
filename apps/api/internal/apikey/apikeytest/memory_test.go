package apikeytest

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		repo := NewMemoryRepository(time.Now)
		next := 0
		return Env{Repo: repo, NewUser: func(_ *testing.T, banned bool) int {
			next++
			repo.AddUser(next, apikey.Owner{Banned: banned})
			return next
		}}
	})
}
