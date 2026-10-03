package user_test

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user/usertest"
)

var (
	errCodeNotFound = errors.New("code not found")
	errCodeMismatch = errors.New("code mismatch")
)

type code struct {
	email string
	value string
}

type fakeCodes struct {
	codes     map[string]code
	requested []string
	ttl       time.Duration
}

func (c *fakeCodes) Request(_ context.Context, email string, ttl time.Duration) (string, error) {
	c.requested = append(c.requested, email)
	c.ttl = ttl
	return "uuid-" + email, nil
}

func (c *fakeCodes) Check(_ context.Context, id, email, value string) error {
	stored, ok := c.codes[id]
	if !ok || stored.email != email {
		return errCodeNotFound
	}
	if stored.value != value {
		return errCodeMismatch
	}
	return nil
}

func (c *fakeCodes) Consume(_ context.Context, id, _ string) error {
	if _, ok := c.codes[id]; !ok {
		return errCodeNotFound
	}
	delete(c.codes, id)
	return nil
}

type fakeSessions struct {
	revoked map[int]string
}

func (s *fakeSessions) RevokeUser(_ context.Context, userID int, reason string) error {
	s.revoked[userID] = reason
	return nil
}

type fakeHasher struct{}

func (fakeHasher) Hash(secret string) (string, error) {
	return "hash:" + secret, nil
}

func (fakeHasher) Verify(hash, secret string) (bool, error) {
	return hash == "hash:"+secret, nil
}

type fakeImages struct {
	stored []string
}

func (i *fakeImages) StoreAvatar(_ context.Context, userID int, upload *media.Upload) (string, error) {
	if err := media.Validate(upload, media.ProfileImageMaxBytes); err != nil {
		return "", err
	}
	i.stored = append(i.stored, "avatar")
	return "user/" + strconv.Itoa(userID) + "/avatar/x.webp", nil
}

func (i *fakeImages) StoreCover(_ context.Context, userID int, upload *media.Upload) (string, error) {
	if err := media.Validate(upload, media.ProfileImageMaxBytes); err != nil {
		return "", err
	}
	i.stored = append(i.stored, "cover")
	return "user/" + strconv.Itoa(userID) + "/cover/x.webp", nil
}

type fixture struct {
	clock    time.Time
	repo     *usertest.MemoryRepository
	codes    *fakeCodes
	sessions *fakeSessions
	images   *fakeImages
	tx       *txtest.Immediate
	service  *user.Service
}

func newFixture(allowRegister bool) *fixture {
	f := &fixture{
		clock:    time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC),
		codes:    &fakeCodes{codes: map[string]code{}},
		sessions: &fakeSessions{revoked: map[int]string{}},
		images:   &fakeImages{},
		tx:       &txtest.Immediate{},
	}
	now := func() time.Time { return f.clock }
	f.repo = usertest.NewMemoryRepository(now)
	f.service = user.NewService(f.repo, f.tx, f.sessions, f.codes, fakeHasher{}, f.images, now, user.Policy{AllowRegister: allowRegister})
	return f
}

func ptr[T any](v T) *T {
	return &v
}

func who(u user.User) actor.Actor {
	return actor.Actor{UserID: u.ID, Role: u.Role, ContentLimit: u.ContentLimit}
}

func registration(name, email string) user.RegisterInput {
	return user.RegisterInput{Name: name, Email: email, Password: "Secret123", Code: "ABC123", CodeID: "code-1", AcceptLanguage: "fr-FR;q=1.0, ja-JP;q=0.8"}
}

func TestRegisterChecksInLegacyOrder(t *testing.T) {
	ctx := context.Background()
	f := newFixture(false)
	f.repo.Seed(user.User{Name: "taken", Email: "taken@example.test"})

	if _, err := f.service.Register(ctx, registration("new", "new@example.test")); !errors.Is(err, errCodeNotFound) {
		t.Fatalf("verification runs first: %v", err)
	}
	f.codes.codes["code-1"] = code{email: "new@example.test", value: "ABC123"}
	if _, err := f.service.Register(ctx, registration("new", "new@example.test")); !errors.Is(err, user.ErrNotAllowRegister) {
		t.Fatalf("closed registration: %v", err)
	}
	f = newFixture(true)
	f.repo.Seed(user.User{Name: "taken", Email: "taken@example.test"})
	f.codes.codes["code-1"] = code{email: "taken@example.test", value: "ABC123"}
	if _, err := f.service.Register(ctx, registration("taken", "taken@example.test")); !errors.Is(err, user.ErrEmailAlreadyExists) {
		t.Fatalf("email check precedes the name check: %v", err)
	}
	f.codes.codes["code-1"] = code{email: "new@example.test", value: "ABC123"}
	if _, err := f.service.Register(ctx, registration("taken", "new@example.test")); !errors.Is(err, user.ErrNameAlreadyExists) {
		t.Fatalf("name taken: %v", err)
	}
	if _, ok := f.codes.codes["code-1"]; !ok {
		t.Fatal("failed registrations must not consume the code")
	}
}

func TestRegisterCreatesTheAccount(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	f.codes.codes["code-1"] = code{email: "new@example.test", value: "ABC123"}
	created, err := f.service.Register(ctx, registration("newbie", "new@example.test"))
	if err != nil {
		t.Fatal(err)
	}
	if created.Lang != user.LangJA || created.ContentLimit != actor.ContentLimitNeverShow || created.PasswordHash == nil || *created.PasswordHash != "hash:Secret123" || created.EmailVerifiedAt == nil {
		t.Fatalf("unexpected account %+v", created)
	}
	if !f.repo.HasDefaultFavorite(created.ID) || !f.repo.HasQuota(created.ID) || f.tx.Calls == 0 {
		t.Fatal("registration must create the favorite and quota inside a transaction")
	}
	if _, ok := f.codes.codes["code-1"]; ok {
		t.Fatal("the verification code must be consumed")
	}
	explicit := registration("other", "other@example.test")
	explicit.Lang = ptr(user.LangZH)
	f.codes.codes["code-1"] = code{email: "other@example.test", value: "ABC123"}
	if second, err := f.service.Register(ctx, explicit); err != nil || second.Lang != user.LangZH {
		t.Fatalf("explicit language wins: %+v %v", second, err)
	}
}

func TestProfileAndMe(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	u := f.repo.Seed(user.User{Name: "alice", Status: user.StatusBanned})
	f.repo.SetStats(u.ID, user.Stats{Resources: 1, Comments: 2, FavoriteItems: 3, Edits: 4, Walkthroughs: 5})
	profile, err := f.service.Profile(ctx, u.ID)
	if err != nil || profile.Name != "alice" || profile.Walkthroughs != 5 || profile.Comments != 2 {
		t.Fatalf("banned users still have public profiles: %+v %v", profile, err)
	}
	if _, err := f.service.Profile(ctx, 999); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing profile: %v", err)
	}
	if _, err := f.service.Me(ctx, actor.Actor{UserID: 999}); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing me: %v", err)
	}
	if taken, _ := f.service.NameTaken(ctx, "alice"); !taken {
		t.Fatal("name check")
	}
}

func TestProfileUpdates(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	alice := f.repo.Seed(user.User{Name: "alice"})
	f.repo.Seed(user.User{Name: "bob"})
	if err := f.service.UpdateName(ctx, who(alice), "bob"); !errors.Is(err, user.ErrNameAlreadyExists) {
		t.Fatalf("taken name: %v", err)
	}
	if err := f.service.UpdateName(ctx, who(alice), "alice"); !errors.Is(err, user.ErrNameAlreadyExists) {
		t.Fatalf("legacy rejects the caller's own name too: %v", err)
	}
	if err := f.service.UpdateName(ctx, who(alice), "carol"); err != nil {
		t.Fatal(err)
	}
	if err := f.service.UpdateLang(ctx, who(alice), "fr"); !errors.Is(err, user.ErrInvalidLang) {
		t.Fatalf("invalid lang: %v", err)
	}
	if err := f.service.UpdateContentLimit(ctx, who(alice), 4); !errors.Is(err, user.ErrInvalidContentLimit) {
		t.Fatalf("invalid content limit: %v", err)
	}
	if err := f.service.UpdateContentLimit(ctx, who(alice), actor.ContentLimitJustShow); err != nil {
		t.Fatal(err)
	}
	if err := f.service.UpdateBio(ctx, who(alice), ""); err != nil {
		t.Fatal(err)
	}
	if err := f.service.UpdateOnlyGamesWithResources(ctx, who(alice), false); err != nil {
		t.Fatal(err)
	}
	got := f.repo.User(alice.ID)
	if got.Name != "carol" || got.ContentLimit != actor.ContentLimitJustShow || got.Bio == nil || *got.Bio != "" || got.OnlyGamesWithResources {
		t.Fatalf("unexpected user %+v", got)
	}
	if err := f.service.UpdateBio(ctx, actor.Actor{UserID: 999}, "x"); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
}

func TestImagesUpdateTheProfile(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	alice := f.repo.Seed(user.User{Name: "alice"})
	if _, err := f.service.UpdateAvatar(ctx, who(alice), nil); !errors.Is(err, upload.ErrSmallFileMissing) {
		t.Fatalf("missing file: %v", err)
	}
	if _, err := f.service.UpdateAvatar(ctx, who(alice), &media.Upload{ContentType: "image/png", Data: make([]byte, media.ProfileImageMaxBytes+1)}); !errors.Is(err, upload.ErrSmallFileTooLarge) {
		t.Fatalf("too large: %v", err)
	}
	key, err := f.service.UpdateAvatar(ctx, who(alice), &media.Upload{ContentType: "image/png", Data: []byte{1}})
	if err != nil || key != "user/1/avatar/x.webp" || f.repo.User(alice.ID).Avatar == nil || *f.repo.User(alice.ID).Avatar != key {
		t.Fatalf("avatar: %s %v", key, err)
	}
	key, err = f.service.UpdateCover(ctx, who(alice), &media.Upload{ContentType: "image/webp", Data: []byte{1}})
	if err != nil || *f.repo.User(alice.ID).Cover != key {
		t.Fatalf("cover: %s %v", key, err)
	}
	if _, err := f.service.UpdateCover(ctx, actor.Actor{UserID: 999}, &media.Upload{ContentType: "image/webp", Data: []byte{1}}); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
	if len(f.images.stored) != 2 {
		t.Fatalf("missing users must not upload: %v", f.images.stored)
	}
}

func TestChangeEmailVerifiesBothCodesBeforeConsuming(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	alice := f.repo.Seed(user.User{Name: "alice", Email: "old@example.test"})
	f.repo.Seed(user.User{Name: "bob", Email: "bob@example.test"})
	uuid, err := f.service.RequestEmailChangeCode(ctx, who(alice))
	if err != nil || uuid != "uuid-old@example.test" || f.codes.ttl != 30*time.Minute {
		t.Fatalf("code goes to the current email for 30 minutes: %s %v %v", uuid, err, f.codes.ttl)
	}
	f.codes.codes["current"] = code{email: "old@example.test", value: "AAA111"}
	f.codes.codes["new"] = code{email: "new@example.test", value: "BBB222"}
	change := user.EmailChange{Email: "new@example.test", CurrentID: "current", CurrentCode: "AAA111", NewID: "new", NewCode: "WRONG"}
	if err := f.service.ChangeEmail(ctx, who(alice), change); !errors.Is(err, errCodeMismatch) {
		t.Fatalf("wrong new code: %v", err)
	}
	if _, ok := f.codes.codes["current"]; !ok {
		t.Fatal("a failed change must keep the current code usable")
	}
	f.codes.codes["bob"] = code{email: "bob@example.test", value: "CCC333"}
	if err := f.service.ChangeEmail(ctx, who(alice), user.EmailChange{Email: "bob@example.test", CurrentID: "current", CurrentCode: "AAA111", NewID: "bob", NewCode: "CCC333"}); !errors.Is(err, user.ErrEmailAlreadyExists) {
		t.Fatalf("taken email: %v", err)
	}
	change.NewCode = "BBB222"
	if err := f.service.ChangeEmail(ctx, who(alice), change); err != nil {
		t.Fatal(err)
	}
	got := f.repo.User(alice.ID)
	if got.Email != "new@example.test" || got.EmailVerifiedAt == nil || f.sessions.revoked[alice.ID] != "user_email_changed" {
		t.Fatalf("email change must update and revoke sessions: %+v %v", got, f.sessions.revoked)
	}
	if len(f.codes.codes) != 1 {
		t.Fatalf("both codes must be consumed: %v", f.codes.codes)
	}
}

func TestChangePassword(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	alice := f.repo.Seed(user.User{Name: "alice", PasswordHash: ptr("hash:Old12345")})
	oidcOnly := f.repo.Seed(user.User{Name: "oidc"})
	if err := f.service.ChangePassword(ctx, who(oidcOnly), "New12345", "anything"); !errors.Is(err, user.ErrInvalidPassword) {
		t.Fatalf("accounts without password: %v", err)
	}
	if err := f.service.ChangePassword(ctx, who(alice), "New12345", "wrong"); !errors.Is(err, user.ErrInvalidPassword) {
		t.Fatalf("wrong old password: %v", err)
	}
	if err := f.service.ChangePassword(ctx, actor.Actor{UserID: 999}, "New12345", "x"); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
	if err := f.service.ChangePassword(ctx, who(alice), "New12345", "Old12345"); err != nil {
		t.Fatal(err)
	}
	if got := f.repo.User(alice.ID); *got.PasswordHash != "hash:New12345" || f.sessions.revoked[alice.ID] != "user_password_changed" {
		t.Fatalf("password change must rehash and revoke sessions: %+v %v", got.PasswordHash, f.sessions.revoked)
	}
}

func TestBanAndUnban(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	target := f.repo.Seed(user.User{Name: "target"})
	root := f.repo.Seed(user.User{Name: "root", Role: actor.RoleSuperAdmin})
	if err := f.service.Ban(ctx, root.ID, user.BanInput{Permanent: true}); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("super admins cannot be banned: %v", err)
	}
	if err := f.service.Ban(ctx, 999, user.BanInput{Permanent: true}); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
	if err := f.service.Ban(ctx, target.ID, user.BanInput{}); !errors.Is(err, user.ErrInvalidBanDuration) {
		t.Fatalf("temporary bans need a duration: %v", err)
	}
	if err := f.service.Ban(ctx, target.ID, user.BanInput{DurationDays: ptr(3), DeleteComments: true, BannedBy: ptr(root.ID)}); err != nil {
		t.Fatal(err)
	}
	if got := f.repo.User(target.ID); got.Status != user.StatusBanned || f.sessions.revoked[target.ID] != "user_banned" || !f.repo.CommentsDeleted(target.ID) || f.repo.OpenBans(target.ID) != 1 {
		t.Fatalf("ban side effects missing: %+v %v", got, f.sessions.revoked)
	}
	if err := f.service.Ban(ctx, target.ID, user.BanInput{Permanent: true}); !errors.Is(err, user.ErrAlreadyBanned) {
		t.Fatalf("double ban: %v", err)
	}
	if err := f.service.Unban(ctx, target.ID); err != nil {
		t.Fatal(err)
	}
	if got := f.repo.User(target.ID); got.Status != user.StatusActive || f.repo.OpenBans(target.ID) != 0 {
		t.Fatalf("unban must close the record: %+v", got)
	}
	if err := f.service.Unban(ctx, target.ID); !errors.Is(err, user.ErrAlreadyUnbanned) {
		t.Fatalf("double unban: %v", err)
	}
	if err := f.service.Unban(ctx, root.ID); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("super admin unban: %v", err)
	}
}

func TestUnbanExpired(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	banned := user.StatusBanned
	expired := f.repo.Seed(user.User{Name: "expired", Status: banned})
	permanent := f.repo.Seed(user.User{Name: "permanent", Status: banned})
	running := f.repo.Seed(user.User{Name: "running", Status: banned})
	zero := f.repo.Seed(user.User{Name: "zero", Status: banned})
	noRecord := f.repo.Seed(user.User{Name: "norecord", Status: banned})
	f.repo.SeedBan(expired.ID, f.clock.Add(-4*24*time.Hour), ptr(3), false)
	f.repo.SeedBan(permanent.ID, f.clock.Add(-400*24*time.Hour), nil, true)
	f.repo.SeedBan(running.ID, f.clock.Add(-2*24*time.Hour), ptr(3), false)
	f.repo.SeedBan(zero.ID, f.clock.Add(-4*24*time.Hour), ptr(0), false)
	if err := f.service.UnbanExpired(ctx); err != nil {
		t.Fatal(err)
	}
	if f.repo.User(expired.ID).Status != user.StatusActive {
		t.Fatal("expired temporary bans are lifted")
	}
	for _, id := range []int{permanent.ID, running.ID, zero.ID, noRecord.ID} {
		if f.repo.User(id).Status != user.StatusBanned {
			t.Fatalf("user %d must stay banned", id)
		}
	}
}

func TestPreferredLang(t *testing.T) {
	cases := map[string]user.Lang{
		"":                                      user.LangEN,
		"fr-FR;q=1.0, ja-JP;q=0.8, en-US;q=0.7": user.LangJA,
		"zh-CN, en-US;q=0.5":                    user.LangZH,
		"fr-FR;q=0.9, *;q=0.1":                  user.LangEN,
		"en;q=0.2, ja;q=0.9":                    user.LangJA,
		"de":                                    user.LangEN,
	}
	for header, want := range cases {
		if got := user.PreferredLang(header); got != want {
			t.Errorf("PreferredLang(%q) = %s, want %s", header, got, want)
		}
	}
}

func TestPasswordPolicy(t *testing.T) {
	cases := map[string]bool{
		"Secret123":   true,
		"Secret!!!":   true,
		"secret123":   false,
		"SECRET123":   false,
		"SecretWord":  false,
		"Secret_Word": false,
		".Secret1":    true,
		"..........":  false,
		"Ab\nc1":      true,
		"ab\nAB":      false,
		"Ab\n":        true,
		"abc\nAb1":    true,
		"Пароль1aA":   true,
		"Пароль_aA":   true,
	}
	for password, want := range cases {
		if got := user.MeetsPasswordPolicy(password); got != want {
			t.Errorf("MeetsPasswordPolicy(%q) = %v, want %v", password, got, want)
		}
	}
}
