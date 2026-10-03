package developertest

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		repo := NewMemoryRepository()
		return Env{
			Repo: repo,
			Seed: func(_ *testing.T, d developer.Developer) int {
				if d.Aliases == nil {
					d.Aliases = []string{}
				}
				if d.ExtraInfo == nil {
					d.ExtraInfo = []developer.ExtraInfo{}
				}
				return repo.Seed(d).ID
			},
			Link: func(_ *testing.T, id int, hidden bool) { repo.Link(id, hidden) },
		}
	})
}
