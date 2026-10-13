package auth_test

import (
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth/authtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user/usertest"
)

type clock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *clock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

var policy = auth.SessionPolicy{
	Version:       "slrt1",
	Pepper:        "pepper",
	AccessTTL:     time.Hour,
	ShortWindow:   7 * 24 * time.Hour,
	LongWindow:    30 * 24 * time.Hour,
	RotationGrace: 100 * time.Second,
	ReplayWait:    40 * time.Millisecond,
	ReplayPoll:    10 * time.Millisecond,
}

type fixture struct {
	clock    *clock
	users    *usertest.MemoryRepository
	repo     *authtest.MemoryRepository
	store    *authtest.MemoryStore
	families *authtest.Blocklist
	mailer   *authtest.Mailer
	tx       *txtest.Immediate
	sessions *auth.SessionService
	codes    *auth.CodeService
	login    *auth.LoginService
	reset    *auth.PasswordResetService
	ceremony *authtest.Ceremony
	passkeys *auth.PasskeyService
	idp      *authtest.IdentityProvider
	oidc     *auth.OIDCService
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	c := &clock{now: time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)}
	f := &fixture{
		clock:    c,
		users:    usertest.NewMemoryRepository(c.Now),
		repo:     authtest.NewMemoryRepository(c.Now),
		store:    authtest.NewMemoryStore(c.Now),
		families: authtest.NewBlocklist(),
		mailer:   &authtest.Mailer{},
		tx:       &txtest.Immediate{},
		ceremony: &authtest.Ceremony{},
		idp:      &authtest.IdentityProvider{},
	}
	f.sessions = auth.NewSessionService(f.repo, f.users, authtest.Codec{}, authtest.Hasher{}, f.families, f.store, f.tx, c.Now, policy)
	f.codes = auth.NewCodeService(f.store, f.mailer, c.Now)
	f.login = auth.NewLoginService(f.users, authtest.Hasher{}, f.sessions, c.Now)
	f.reset = auth.NewPasswordResetService(f.users, f.store, f.mailer, authtest.Hasher{}, f.sessions, f.tx, "https://shionlib.example")
	f.passkeys = auth.NewPasskeyService(f.users, f.repo, f.ceremony, f.store, f.sessions, f.tx, c.Now, 5*time.Minute)
	f.oidc = auth.NewOIDCService(f.idp, f.repo, f.repo, f.users, f.sessions, f.tx, c.Now, []string{"https://shionlib.example", "https://shionlib.org"})
	return f
}

func (f *fixture) seedUser(mutate ...func(*user.User)) user.User {
	hash := "hash:Secret123"
	u := user.User{PasswordHash: &hash, ContentLimit: actor.ContentLimitShowSpoiler}
	for _, fn := range mutate {
		fn(&u)
	}
	return f.users.Seed(u)
}

func ptr[T any](v T) *T {
	return &v
}
