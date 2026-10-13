package settingtest

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(t *testing.T) Env {
		clock := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		repo := NewMemoryRepository(func() time.Time {
			clock = clock.Add(time.Second)
			return clock
		})
		editors := 0
		return Env{
			Repo: repo,
			NewEditor: func(*testing.T) setting.Editor {
				editors++
				return repo.AddEditor(editors, "editor")
			},
		}
	})
}
