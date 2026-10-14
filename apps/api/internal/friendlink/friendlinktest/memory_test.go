package friendlinktest

import "testing"

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		return Env{Repo: NewMemoryRepository()}
	})
}
