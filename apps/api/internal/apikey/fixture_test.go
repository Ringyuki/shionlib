package apikey_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey/apikeytest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

var (
	owner  = actor.Actor{UserID: 1, Role: actor.RoleUser}
	banned = actor.Actor{UserID: 2, Role: actor.RoleUser}
	admin  = actor.Actor{UserID: 9, Role: actor.RoleAdmin}
)

type fixture struct {
	service  *apikey.Service
	access   *apikey.AccessService
	admin    *apikey.AdminService
	repo     *apikeytest.MemoryRepository
	counter  *apikeytest.Counter
	usage    *apikeytest.UsageStore
	messages *apikeytest.Messages
	settings settingtest.Source
	clock    *time.Time
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	clock := time.Date(2026, 10, 14, 3, 0, 0, 0, time.UTC)
	f := fixture{
		repo:     apikeytest.NewMemoryRepository(func() time.Time { return clock }),
		counter:  apikeytest.NewCounter(),
		usage:    &apikeytest.UsageStore{Details: map[int]apikey.Detail{}},
		messages: &apikeytest.Messages{},
		settings: settingtest.Source{},
		clock:    &clock,
	}
	f.repo.AddUser(owner.UserID, apikey.Owner{})
	f.repo.AddUser(banned.UserID, apikey.Owner{Banned: true})
	deps := apikey.Deps{
		Repo:     f.repo,
		Usage:    f.usage,
		Counter:  f.counter,
		Messages: f.messages,
		Tx:       apikeytest.Transactor{},
		Settings: f.settings,
		Now:      func() time.Time { return *f.clock },
	}
	f.service, f.access, f.admin = apikey.NewService(deps), apikey.NewAccessService(deps), apikey.NewAdminService(deps)
	return f
}
