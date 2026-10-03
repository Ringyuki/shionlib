package usertest

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type Repository interface {
	user.Repository
	FindByIdentifier(ctx context.Context, identifier string) (user.User, bool, error)
	FindByEmailFold(ctx context.Context, email string) (user.User, bool, error)
}

type Env struct {
	Repo               Repository
	HasDefaultFavorite func(t *testing.T, userID int) bool
	HasQuota           func(t *testing.T, userID int) bool
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	hash := "$argon2id$hash"

	t.Run("create provisions the default favorite and upload quota", func(t *testing.T) {
		env := newEnv(t)
		verified := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
		created, err := env.Repo.Create(ctx, user.NewUser{Name: "Alice", Email: "Alice@Example.test", PasswordHash: &hash, Lang: user.LangJA, ContentLimit: actor.ContentLimitNeverShow, EmailVerifiedAt: &verified})
		if err != nil {
			t.Fatal(err)
		}
		if created.ID == 0 || created.Name != "Alice" || created.Lang != user.LangJA || created.ContentLimit != actor.ContentLimitNeverShow || created.Role != actor.RoleUser || created.Status != user.StatusActive || !created.OnlyGamesWithResources {
			t.Fatalf("unexpected user %+v", created)
		}
		if created.PasswordHash == nil || *created.PasswordHash != hash || created.EmailVerifiedAt == nil || !created.EmailVerifiedAt.Equal(verified) {
			t.Fatalf("credentials not stored %+v", created)
		}
		if !env.HasDefaultFavorite(t, created.ID) || !env.HasQuota(t, created.ID) {
			t.Fatal("registration must create the default favorite and the upload quota")
		}
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil || got.Email != "Alice@Example.test" {
			t.Fatalf("get: %+v %v", got, err)
		}
	})

	t.Run("unique names and emails are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		first, err := env.Repo.Create(ctx, user.NewUser{Name: "dup", Email: "dup@example.test", Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Create(ctx, user.NewUser{Name: "other", Email: "dup@example.test", Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow}); !errors.Is(err, user.ErrEmailAlreadyExists) {
			t.Fatalf("duplicate email: %v", err)
		}
		if _, err := env.Repo.Create(ctx, user.NewUser{Name: "dup", Email: "other@example.test", Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow}); !errors.Is(err, user.ErrNameAlreadyExists) {
			t.Fatalf("duplicate name: %v", err)
		}
		second, err := env.Repo.Create(ctx, user.NewUser{Name: "second", Email: "second@example.test", Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow})
		if err != nil {
			t.Fatal(err)
		}
		name := first.Name
		if err := env.Repo.Update(ctx, second.ID, user.Changes{Name: &name}); !errors.Is(err, user.ErrNameAlreadyExists) {
			t.Fatalf("rename onto taken name: %v", err)
		}
		email := first.Email
		if err := env.Repo.Update(ctx, second.ID, user.Changes{Email: &email}); !errors.Is(err, user.ErrEmailAlreadyExists) {
			t.Fatalf("change onto taken email: %v", err)
		}
	})

	t.Run("lookups follow the legacy case rules", func(t *testing.T) {
		env := newEnv(t)
		created, err := env.Repo.Create(ctx, user.NewUser{Name: "MiXed", Email: "Mixed@Example.test", Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow})
		if err != nil {
			t.Fatal(err)
		}
		if found, ok, err := env.Repo.FindByIdentifier(ctx, "mixed"); err != nil || !ok || found.ID != created.ID {
			t.Fatalf("identifier by name: %+v %v %v", found, ok, err)
		}
		if found, ok, err := env.Repo.FindByIdentifier(ctx, "MIXED@example.TEST"); err != nil || !ok || found.ID != created.ID {
			t.Fatalf("identifier by email: %+v %v %v", found, ok, err)
		}
		if _, ok, err := env.Repo.FindByIdentifier(ctx, "mix%"); err != nil || ok {
			t.Fatalf("wildcards must not match: %v %v", ok, err)
		}
		if _, ok, _ := env.Repo.FindByEmail(ctx, "mixed@example.test"); ok {
			t.Fatal("email lookup is exact")
		}
		if found, ok, _ := env.Repo.FindByEmailFold(ctx, "mixed@example.test"); !ok || found.ID != created.ID {
			t.Fatal("folded email lookup must ignore case")
		}
		if taken, _ := env.Repo.NameExists(ctx, "mixed"); taken {
			t.Fatal("name check is exact")
		}
		if taken, _ := env.Repo.NameExists(ctx, "MiXed"); !taken {
			t.Fatal("existing name must be reported")
		}
	})

	t.Run("update applies only provided fields and reports missing users", func(t *testing.T) {
		env := newEnv(t)
		created, err := env.Repo.Create(ctx, user.NewUser{Name: "upd", Email: "upd@example.test", Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow})
		if err != nil {
			t.Fatal(err)
		}
		bio, lang, limit, banned, twoFactor, only := "hello", user.LangZH, actor.ContentLimitJustShow, user.StatusBanned, true, false
		at := time.Date(2026, 2, 3, 4, 5, 6, 0, time.UTC)
		if err := env.Repo.Update(ctx, created.ID, user.Changes{Bio: &bio, Lang: &lang, ContentLimit: &limit, Status: &banned, TwoFactorEnabled: &twoFactor, OnlyGamesWithResources: &only, LastLoginAt: &at}); err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Get(ctx, created.ID)
		if got.Bio == nil || *got.Bio != bio || got.Lang != lang || got.ContentLimit != limit || got.Status != banned || !got.TwoFactorEnabled || got.OnlyGamesWithResources || got.Name != "upd" {
			t.Fatalf("unexpected user after update %+v", got)
		}
		if err := env.Repo.Update(ctx, 987654, user.Changes{Bio: &bio}); !errors.Is(err, user.ErrNotFound) {
			t.Fatalf("update missing: %v", err)
		}
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, user.ErrNotFound) {
			t.Fatalf("get missing: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, user.ErrNotFound) {
			t.Fatalf("lock missing: %v", err)
		}
	})

	t.Run("bans list the latest open record of banned users", func(t *testing.T) {
		env := newEnv(t)
		created, err := env.Repo.Create(ctx, user.NewUser{Name: "ban", Email: "ban@example.test", Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow})
		if err != nil {
			t.Fatal(err)
		}
		days := 3
		if err := env.Repo.CreateBan(ctx, user.NewBan{UserID: created.ID, DurationDays: &days}); err != nil {
			t.Fatal(err)
		}
		if bans, err := env.Repo.ActiveBans(ctx); err != nil || len(bans) != 0 {
			t.Fatalf("users that are not banned are skipped: %+v %v", bans, err)
		}
		banned := user.StatusBanned
		if err := env.Repo.Update(ctx, created.ID, user.Changes{Status: &banned}); err != nil {
			t.Fatal(err)
		}
		bans, err := env.Repo.ActiveBans(ctx)
		if err != nil || len(bans) != 1 || bans[0].UserID != created.ID || bans[0].DurationDays == nil || *bans[0].DurationDays != 3 || bans[0].Permanent {
			t.Fatalf("active bans: %+v %v", bans, err)
		}
		if err := env.Repo.CloseLatestBan(ctx, created.ID, time.Now().UTC()); err != nil {
			t.Fatal(err)
		}
		if bans, err := env.Repo.ActiveBans(ctx); err != nil || len(bans) != 0 {
			t.Fatalf("closed bans are not active: %+v %v", bans, err)
		}
		if err := env.Repo.DeleteComments(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
	})
}
