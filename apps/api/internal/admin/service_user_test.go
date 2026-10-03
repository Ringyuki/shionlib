package admin_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin/admintest"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user/usertest"
)

var now = time.Date(2026, 2, 18, 1, 0, 0, 0, time.UTC)

func clock() time.Time {
	return now
}

func ptr[T any](v T) *T {
	return &v
}

type fixture struct {
	accounts    *usertest.MemoryRepository
	store       *admintest.UserStore
	permissions *admintest.PermissionStore
	sessions    *admintest.Sessions
	quotas      *uploadtest.MemoryQuotaRepository
	service     *admin.UserService
	member      user.User
	peer        user.User
	staff       user.User
	owner       user.User
	otherOwner  user.User
}

func newFixture() fixture {
	f := fixture{
		accounts:    usertest.NewMemoryRepository(clock),
		store:       admintest.NewUserStore(),
		permissions: admintest.NewPermissionStore(),
		sessions:    admintest.NewSessions(),
		quotas:      uploadtest.NewMemoryQuotaRepository(),
	}
	tx := &txtest.Immediate{}
	profiles := user.NewService(f.accounts, tx, f.sessions, nil, admintest.Hasher{}, nil, clock, user.Policy{})
	f.service = admin.NewUserService(admin.UserDeps{
		Accounts:    f.accounts,
		Store:       f.store,
		Permissions: f.permissions,
		Bans:        profiles,
		Sessions:    f.sessions,
		Passwords:   admintest.Hasher{},
		Quotas:      upload.NewQuotaService(f.quotas, tx, upload.QuotaPolicy{}, clock),
		Tx:          tx,
	})
	f.member = f.accounts.Seed(user.User{Name: "member"})
	f.peer = f.accounts.Seed(user.User{Name: "peer", Role: actor.RoleAdmin})
	f.staff = f.accounts.Seed(user.User{Name: "staff", Role: actor.RoleAdmin})
	f.owner = f.accounts.Seed(user.User{Name: "owner", Role: actor.RoleSuperAdmin})
	f.otherOwner = f.accounts.Seed(user.User{Name: "other", Role: actor.RoleSuperAdmin})
	return f
}

func as(u user.User) actor.Actor {
	return actor.Actor{UserID: u.ID, Role: u.Role, ContentLimit: u.ContentLimit}
}

func TestCanManage(t *testing.T) {
	f := newFixture()
	cases := []struct {
		name   string
		who    user.User
		target user.User
		want   bool
	}{
		{"admin manages members", f.staff, f.member, true},
		{"admin does not manage other admins", f.staff, f.peer, false},
		{"admin does not manage super admins", f.staff, f.owner, false},
		{"admin manages own account", f.staff, f.staff, true},
		{"super admin manages admins", f.owner, f.peer, true},
		{"super admin manages super admins", f.owner, f.otherOwner, true},
	}
	for _, c := range cases {
		if got := admin.CanManage(as(c.who), c.target); got != c.want {
			t.Fatalf("%s: got %v", c.name, got)
		}
	}
	ctx := context.Background()
	if err := f.service.ForceLogout(ctx, as(f.staff), f.peer.ID); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("peers are protected: %v", err)
	}
	if err := f.service.ForceLogout(ctx, as(f.staff), 999); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing target: %v", err)
	}
	if err := f.service.ForceLogout(ctx, as(f.staff), f.staff.ID); err != nil {
		t.Fatalf("force-logout allows the caller's own account: %v", err)
	}
	if reason, _ := f.sessions.Revoked(f.staff.ID); reason != admin.ReasonForceLogout {
		t.Fatalf("revocation reason: %q", reason)
	}
}

func TestSelfTargetedActionsAreRejected(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	who := as(f.owner)
	checks := map[string]error{
		"role":  f.service.SetRole(ctx, who, f.owner.ID, actor.RoleUser),
		"ban":   f.service.Ban(ctx, who, f.owner.ID, user.BanInput{Permanent: true}),
		"unban": f.service.Unban(ctx, who, f.owner.ID),
		"reset": f.service.ResetPassword(ctx, who, f.owner.ID, "Secret12"),
	}
	for name, err := range checks {
		if !errors.Is(err, auth.ErrUnauthorized) {
			t.Fatalf("%s: %v", name, err)
		}
	}
}

func TestSetRoleRequiresSuperAdmin(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	if err := f.service.SetRole(ctx, as(f.staff), f.member.ID, actor.RoleAdmin); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("admins cannot change roles: %v", err)
	}
	if err := f.service.SetRole(ctx, as(f.owner), 999, actor.RoleAdmin); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing target first: %v", err)
	}
	if err := f.service.SetRole(ctx, as(f.owner), f.otherOwner.ID, actor.RoleAdmin); err != nil {
		t.Fatal(err)
	}
	if role, _ := f.store.Role(f.otherOwner.ID); role != actor.RoleAdmin {
		t.Fatalf("role: %v", role)
	}
}

func TestBanAndUnbanDelegateToTheUserService(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	impostor := 77
	if err := f.service.Ban(ctx, as(f.staff), f.member.ID, user.BanInput{BannedBy: &impostor, DurationDays: ptr(3), DeleteComments: true}); err != nil {
		t.Fatal(err)
	}
	if got := f.accounts.User(f.member.ID); !got.Banned() || f.accounts.OpenBans(f.member.ID) != 1 || !f.accounts.CommentsDeleted(f.member.ID) {
		t.Fatalf("ban not applied: %+v", got)
	}
	if reason, _ := f.sessions.Revoked(f.member.ID); reason != "user_banned" {
		t.Fatalf("sessions: %q", reason)
	}
	if err := f.service.Ban(ctx, as(f.staff), f.member.ID, user.BanInput{Permanent: true}); !errors.Is(err, user.ErrAlreadyBanned) {
		t.Fatalf("second ban: %v", err)
	}
	if err := f.service.Ban(ctx, as(f.staff), f.peer.ID, user.BanInput{Permanent: true}); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("admins cannot ban admins: %v", err)
	}
	if err := f.service.Ban(ctx, as(f.owner), f.otherOwner.ID, user.BanInput{Permanent: true}); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("super admins are never banned: %v", err)
	}
	if err := f.service.Unban(ctx, as(f.staff), f.member.ID); err != nil {
		t.Fatal(err)
	}
	if got := f.accounts.User(f.member.ID); got.Banned() || f.accounts.OpenBans(f.member.ID) != 0 {
		t.Fatalf("unban not applied: %+v", got)
	}
	if err := f.service.Unban(ctx, as(f.staff), f.member.ID); !errors.Is(err, user.ErrAlreadyUnbanned) {
		t.Fatalf("second unban: %v", err)
	}
}

func TestResetPasswordRevokesSessions(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	if err := f.service.ResetPassword(ctx, as(f.owner), f.peer.ID, "Secret12"); err != nil {
		t.Fatal(err)
	}
	if got := f.accounts.User(f.peer.ID); got.PasswordHash == nil || *got.PasswordHash != "hash:Secret12" {
		t.Fatalf("password: %+v", got.PasswordHash)
	}
	if reason, _ := f.sessions.Revoked(f.peer.ID); reason != admin.ReasonResetPassword {
		t.Fatalf("sessions: %q", reason)
	}
	if err := f.service.ResetPassword(ctx, as(f.staff), f.peer.ID, "Secret12"); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("peer reset: %v", err)
	}
}

func TestUpdateProfile(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	who := as(f.staff)
	if _, _, err := f.service.UpdateProfile(ctx, who, f.member.ID, admin.ProfileChanges{Name: ptr("peer")}); !errors.Is(err, user.ErrNameAlreadyExists) {
		t.Fatalf("name conflict: %v", err)
	}
	if _, _, err := f.service.UpdateProfile(ctx, who, f.member.ID, admin.ProfileChanges{Email: ptr(f.peer.Email)}); !errors.Is(err, user.ErrEmailAlreadyExists) {
		t.Fatalf("email conflict: %v", err)
	}
	same, changed, err := f.service.UpdateProfile(ctx, who, f.member.ID, admin.ProfileChanges{Name: ptr("member"), Email: ptr(f.member.Email)})
	if err != nil || changed || same.ID != f.member.ID {
		t.Fatalf("unchanged values are a no-op: %+v %v %v", same, changed, err)
	}
	lang, limit := user.LangJA, actor.ContentLimitJustShow
	updated, changed, err := f.service.UpdateProfile(ctx, who, f.member.ID, admin.ProfileChanges{Name: ptr("renamed"), Email: ptr("new@example.test"), Lang: &lang, ContentLimit: &limit})
	if err != nil || !changed || updated.Name != "renamed" || updated.Email != "new@example.test" || updated.Lang != lang || updated.ContentLimit != limit {
		t.Fatalf("updated: %+v %v %v", updated, changed, err)
	}
	if _, _, err := f.service.UpdateProfile(ctx, who, f.peer.ID, admin.ProfileChanges{Lang: &lang}); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("peer profile: %v", err)
	}
}

func TestPermissionsMergeRoleAndUserMasks(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	f.permissions.SetRoleMask(actor.RoleUser, admin.PermissionGame, 3)
	f.permissions.SetMappings(admin.PermissionGame,
		admin.PermissionMapping{Field: "MANAGE_LINKS", BitIndex: 10, IsRelation: true},
		admin.PermissionMapping{Field: "IDS", BitIndex: 0},
		admin.PermissionMapping{Field: "TITLES", BitIndex: 1},
		admin.PermissionMapping{Field: "RELEASE", BitIndex: 4},
	)
	mask, err := f.service.SetPermissions(ctx, as(f.staff), f.member.ID, admin.PermissionGame, []int{10, 0})
	if err != nil || mask != 1025 {
		t.Fatalf("mask: %d %v", mask, err)
	}
	if _, err := f.service.SetPermissions(ctx, as(f.staff), f.member.ID, admin.PermissionGame, []int{10, 3, 99}); !errors.Is(err, apperror.ErrValidationFailed) {
		t.Fatalf("unknown bits: %v", err)
	} else if appErr, _ := apperror.From(err); !slices.Equal(appErr.Args()["invalidBits"].([]int), []int{3, 99}) {
		t.Fatalf("invalid bits: %v", appErr.Args())
	}
	view, err := f.service.Permissions(ctx, as(f.staff), f.member.ID, admin.PermissionGame)
	if err != nil || view.RoleMask != 3 || view.UserMask != 1025 || view.AllowMask != 1027 || len(view.Groups) != 4 {
		t.Fatalf("view: %+v %v", view, err)
	}
	ids, titles, release, links := view.Groups[0], view.Groups[1], view.Groups[2], view.Groups[3]
	if ids.Field != "IDS" || !ids.Enabled || ids.Source != admin.SourceRole || ids.Mutable || !slices.Equal(ids.Fields, []string{"v_id", "b_id"}) {
		t.Fatalf("role bits win: %+v", ids)
	}
	if !titles.Enabled || titles.Source != admin.SourceRole {
		t.Fatalf("titles: %+v", titles)
	}
	if release.Enabled || release.Source != admin.SourceNone || !release.Mutable || !slices.Equal(release.Fields, []string{"release_date", "release_date_tba"}) {
		t.Fatalf("release: %+v", release)
	}
	if !links.Enabled || links.Source != admin.SourceUser || !links.Mutable || !links.IsRelation {
		t.Fatalf("links: %+v", links)
	}
	if mask, err := f.service.SetPermissions(ctx, as(f.staff), f.member.ID, admin.PermissionGame, nil); err != nil || mask != 0 {
		t.Fatalf("an empty list clears the user mask: %d %v", mask, err)
	}
	if stored, ok := f.permissions.StoredUserMask(f.member.ID, admin.PermissionGame); !ok || stored != 0 {
		t.Fatalf("stored: %d %v", stored, ok)
	}
	if _, err := f.service.Permissions(ctx, as(f.staff), f.peer.ID, admin.PermissionGame); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("peer permissions: %v", err)
	}
	if got := admin.GroupFields(admin.PermissionCharacter, "UNKNOWN"); got == nil || len(got) != 0 {
		t.Fatalf("unknown groups have no fields: %v", got)
	}
}

func TestQuotaAdjustmentsUseTheUploadQuota(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	who := as(f.staff)
	if err := f.service.AdjustQuotaSize(ctx, who, f.member.ID, admin.QuotaChange{Action: upload.ActionAdd, Amount: 100}); err != nil {
		t.Fatal(err)
	}
	if err := f.service.AdjustQuotaUsed(ctx, who, f.member.ID, admin.QuotaChange{Action: upload.ActionUse, Amount: 40, Reason: "fix"}); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(f.member.ID); got.Size != 100 || got.Used != 40 {
		t.Fatalf("quota: %+v", got)
	}
	if err := f.service.AdjustQuotaSize(ctx, who, f.member.ID, admin.QuotaChange{Action: upload.ActionSub, Amount: 61}); !errors.Is(err, upload.ErrQuotaExceeded) {
		t.Fatalf("size below used: %v", err)
	}
	if err := f.service.ResetQuotaUsed(ctx, who, f.member.ID); err != nil {
		t.Fatal(err)
	}
	if got := f.quotas.Quota(f.member.ID); got.Used != 0 {
		t.Fatalf("reset: %+v", got)
	}
	if err := f.service.ResetQuotaUsed(ctx, who, f.peer.ID); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("peer quota: %v", err)
	}
}

func TestSponsorExpiry(t *testing.T) {
	f := newFixture()
	ctx := context.Background()
	until := now.Add(24 * time.Hour)
	if err := f.service.SetSponsorExpiry(ctx, f.owner.ID, &until); err != nil {
		t.Fatalf("any admin may set the badge, even on super admins: %v", err)
	}
	if got, ok := f.store.Sponsor(f.owner.ID); !ok || got == nil || !got.Equal(until) {
		t.Fatalf("sponsor: %v %v", got, ok)
	}
	if err := f.service.SetSponsorExpiry(ctx, f.owner.ID, nil); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.store.Sponsor(f.owner.ID); got != nil {
		t.Fatalf("cleared: %v", got)
	}
	if err := f.service.SetSponsorExpiry(ctx, 999, nil); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
}

func TestSearchTrimsTheKeyword(t *testing.T) {
	f := newFixture()
	if _, _, err := f.service.Search(context.Background(), admin.UserFilter{Search: "  ring "}, admin.Page{Number: 2, Size: 5}); err != nil {
		t.Fatal(err)
	}
	if filter, page := f.store.LastQuery(); filter.Search != "ring" || page.Number != 2 || page.Size != 5 {
		t.Fatalf("query: %+v %+v", filter, page)
	}
}
