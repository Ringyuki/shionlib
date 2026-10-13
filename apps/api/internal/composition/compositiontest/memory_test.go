package compositiontest

import (
	"testing"
	"time"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		next := 0
		return Env{
			Repo:        NewMemoryRepository(func() time.Time { return time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC) }),
			NewResource: func(*testing.T) int { next++; return 500 + next },
		}
	})
}
