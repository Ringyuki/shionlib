package setting_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	testLimit  = setting.Int(setting.Spec[int]{Name: "fixture.limit", Label: "次数", Default: 10, Min: 1, Max: 100})
	testQuota  = setting.Bytes(setting.Spec[int64]{Name: "fixture.quota", Label: "配额", Default: 5 << 30, Min: 0, Max: 1 << 40})
	testWeight = setting.Float(setting.Spec[float64]{Name: "fixture.weight", Label: "权重", Default: 0.6, Min: 0, Max: 10})
	testWindow = setting.Duration(setting.Spec[time.Duration]{Name: "fixture.window", Label: "窗口", Default: time.Hour, Min: time.Second, Max: 48 * time.Hour})
	testOpen   = setting.Flag(setting.Spec[bool]{Name: "fixture.open", Label: "开关", Default: true})
	testNote   = setting.Text(setting.Spec[string]{Name: "fixture.note", Label: "备注", Default: "默认", MaxLength: 4})
	testSecret = setting.Secret(setting.Spec[string]{Name: "fixture.secret", Label: "密钥", MaxLength: 40})
)

var superAdmin = actor.Actor{UserID: 7, Role: actor.RoleSuperAdmin}

type fixture struct {
	repo      *settingtest.MemoryRepository
	announcer *settingtest.Announcer
	service   *setting.Service
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	clock := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	repo := settingtest.NewMemoryRepository(func() time.Time {
		clock = clock.Add(time.Minute)
		return clock
	})
	repo.AddEditor(superAdmin.UserID, "shion")
	announcer := &settingtest.Announcer{}
	return fixture{
		repo:      repo,
		announcer: announcer,
		service:   setting.NewService(setting.Deps{Repo: repo, Tx: &txtest.Immediate{}, Announcer: announcer}),
	}
}
