package charactertest

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		repo := NewMemoryRepository()
		return Env{
			Repo: repo,
			Seed: func(_ *testing.T, c character.Character) int { return repo.Seed(c).ID },
			Link: func(_ *testing.T, id int) { repo.Link(id) },
		}
	})
}
