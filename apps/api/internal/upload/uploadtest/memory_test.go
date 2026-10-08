package uploadtest

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(t *testing.T) Env {
		repo := NewMemoryRepository(time.Now)
		users := 0
		return Env{
			Repo:       repo,
			NewUser:    func(*testing.T) int { users++; return users },
			AttachFile: func(_ *testing.T, sessionID int, path string) { repo.AttachFile(sessionID, path) },
		}
	})
}

func TestMemoryHoldsContract(t *testing.T) {
	HoldsContract(t, func(*testing.T) upload.Holds { return NewMemoryHolds() })
}
