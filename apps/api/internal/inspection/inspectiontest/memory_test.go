package inspectiontest

import "testing"

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		repo := NewMemoryRepository()
		return Env{
			Repo:        repo,
			NewResource: func(*testing.T) int { return repo.NewResource() },
			Attach:      func(_ *testing.T, id int) { repo.Attach(id) },
		}
	})
}
