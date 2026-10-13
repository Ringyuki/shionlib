package translatortest

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		repo := NewMemoryRepository()
		games := 0
		return Env{
			Repo:  repo,
			Store: repo,
			Seed: func(_ *testing.T, item translator.Translator) int {
				return repo.Seed(item).ID
			},
			NewGame: func(*testing.T) int {
				games++
				return games
			},
			Credit: func(_ *testing.T, gameID int, visible bool, at time.Time, translatorIDs ...int) int {
				return repo.Credit(gameID, visible, at, translatorIDs...)
			},
			Credited: func(_ *testing.T, resourceID int) []int {
				return repo.Credited(resourceID)
			},
		}
	})
}
