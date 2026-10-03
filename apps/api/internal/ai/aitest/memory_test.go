package aitest

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) RepositoryEnv {
		repo := NewMemoryRepository(time.Now)
		return RepositoryEnv{
			Repo:            repo,
			SuperAdmin:      func(*testing.T) int { return repo.AddSuperAdmin() },
			CatalogProvider: func(*testing.T, string) {},
		}
	})
}

func TestMemoryCatalogStoreContract(t *testing.T) {
	CatalogStoreContract(t, func(*testing.T) ai.CatalogStore {
		return NewMemoryCatalogStore()
	})
}

func TestMemoryRequestLogContract(t *testing.T) {
	RequestLogContract(t, func(*testing.T) RequestLogEnv {
		repo := NewMemoryRepository(time.Now)
		return RequestLogEnv{Log: NewMemoryRequestLog(repo), Repo: repo}
	})
}
