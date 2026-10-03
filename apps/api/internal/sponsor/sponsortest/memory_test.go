package sponsortest

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(t *testing.T) Env {
		clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		repo := NewMemoryRepository(func() time.Time {
			clock = clock.Add(time.Second)
			return clock
		})
		users := 0
		return Env{
			Repo: repo,
			NewUser: func(*testing.T) int {
				users++
				repo.AddUser(user.Summary{ID: users, Name: "member"})
				return users
			},
			SponsorUntil: func(_ *testing.T, id int) *time.Time {
				summary, _ := repo.User(id)
				return summary.SponsorExpiresAt
			},
		}
	})
}
