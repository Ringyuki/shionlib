package adminhttp_test

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin/admintest"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adminhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user/usertest"
)

var stamp = time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

func ptr[T any](v T) *T {
	return &v
}

type userEnv struct {
	server      *apitest.Server
	accounts    *usertest.MemoryRepository
	store       *admintest.UserStore
	permissions *admintest.PermissionStore
	sessions    *admintest.Sessions
	quotas      *uploadtest.MemoryQuotaRepository
	member      user.User
	peer        user.User
	staff       actor.Actor
	owner       actor.Actor
}

func newUserEnv(t *testing.T) userEnv {
	t.Helper()
	env := userEnv{
		server:      apitest.New(t),
		accounts:    usertest.NewMemoryRepository(func() time.Time { return apitest.Now }),
		store:       admintest.NewUserStore(),
		permissions: admintest.NewPermissionStore(),
		sessions:    admintest.NewSessions(),
		quotas:      uploadtest.NewMemoryQuotaRepository(),
	}
	now := func() time.Time { return apitest.Now }
	tx := &txtest.Immediate{}
	profiles := user.NewService(env.accounts, tx, env.sessions, nil, admintest.Hasher{}, nil, now, user.Policy{})
	service := admin.NewUserService(admin.UserDeps{
		Accounts:    env.accounts,
		Store:       env.store,
		Permissions: env.permissions,
		Bans:        profiles,
		Sessions:    env.sessions,
		Passwords:   admintest.Hasher{},
		Quotas:      upload.NewQuotaService(env.quotas, tx, upload.QuotaPolicy{}, now),
		Tx:          tx,
	})
	adminhttp.NewUserHandler(service, env.server.Builder).Register(env.server.API)
	env.member = env.accounts.Seed(user.User{Name: "member"})
	env.peer = env.accounts.Seed(user.User{Name: "peer", Role: actor.RoleAdmin})
	staff := env.accounts.Seed(user.User{Name: "staff", Role: actor.RoleAdmin})
	owner := env.accounts.Seed(user.User{Name: "owner", Role: actor.RoleSuperAdmin})
	env.staff = actor.Actor{UserID: staff.ID, Role: staff.Role, ContentLimit: actor.ContentLimitNeverShow}
	env.owner = actor.Actor{UserID: owner.ID, Role: owner.Role, ContentLimit: actor.ContentLimitNeverShow}
	return env
}

func (e userEnv) path(id int, suffix string) string {
	return "/admin/users/" + strconv.Itoa(id) + suffix
}

func TestAdminUserRoutesRequireAnAdministrator(t *testing.T) {
	env := newUserEnv(t)
	member := actor.Actor{UserID: env.member.ID, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users"}), http.StatusUnauthorized, 200101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(env.peer.ID, "/force-logout"), As: &member}), http.StatusForbidden, 403)
}

func TestAdminUserListShape(t *testing.T) {
	env := newUserEnv(t)
	env.store.AddEntry(admin.UserEntry{
		ID: 3, Name: "ring", Email: "ring@example.test", Role: actor.RoleAdmin, Status: user.StatusActive, Lang: user.LangZH, ContentLimit: actor.ContentLimitShowSpoiler,
		Created: stamp, Updated: stamp, TwoFactorEnabled: true, SponsorExpiresAt: &stamp, Counts: admin.Counts{Comments: 1, Resources: 2, Favorites: 3, Edits: 4},
	})
	resp := env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users?page=1&pageSize=20&search=ring&sortBy=created&sortOrder=desc&role=2&status=1", As: &env.staff})
	env.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":3,"name":"ring","email":"ring@example.test","avatar":null,"role":2,"status":1,"lang":"zh","content_limit":2,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z","last_login_at":null,"two_factor_enabled":true,"sponsor_expires_at":"2026-01-02T03:04:05.000Z","counts":{"comments":1,"resources":2,"favorites":3,"edits":4}}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":20,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("list\n got %s\nwant %s", resp.Data, want)
	}
	filter, page := env.store.LastQuery()
	if filter.Search != "ring" || *filter.Role != actor.RoleAdmin || *filter.Status != user.StatusActive || filter.SortBy != admin.UserSortByCreated || !filter.Descending || page.Size != 20 {
		t.Fatalf("filter: %+v %+v", filter, page)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users?role=4", As: &env.staff}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users?sortBy=password", As: &env.staff}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminUserDetailShape(t *testing.T) {
	env := newUserEnv(t)
	env.store.AddDetail(admin.UserDetail{
		UserEntry: admin.UserEntry{ID: 5, Name: "five", Email: "five@example.test", Role: actor.RoleUser, Status: user.StatusBanned, Lang: user.LangEN, ContentLimit: actor.ContentLimitNeverShow, Created: stamp, Updated: stamp},
		Quota:     &admin.Quota{Size: 1 << 53, Used: 7, IsFirstGrant: true},
		LatestBan: &admin.BanRecord{BannedAt: stamp, Reason: ptr("spam"), DurationDays: ptr(3), BannedBy: &admin.UserRef{ID: 1, Name: "root"}},
	})
	env.store.AddDetail(admin.UserDetail{UserEntry: admin.UserEntry{ID: 6, Name: "six", Email: "six@example.test", Role: actor.RoleUser, Status: user.StatusActive, Lang: user.LangJA, ContentLimit: actor.ContentLimitNeverShow, Created: stamp, Updated: stamp}})
	resp := env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users/5", As: &env.staff})
	env.server.Expect(resp, http.StatusOK, 0)
	want := `{"id":5,"name":"five","email":"five@example.test","avatar":null,"cover":null,"role":1,"status":2,"lang":"en","content_limit":1,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z","last_login_at":null,"two_factor_enabled":false,"sponsor_expires_at":null,"upload_quota":{"size":"9007199254740992","used":"7","is_first_grant":true},"counts":{"comments":0,"resources":0,"favorites":0,"edits":0},"latest_ban":{"banned_at":"2026-01-02T03:04:05.000Z","banned_reason":"spam","banned_duration_days":3,"is_permanent":false,"unbanned_at":null,"banned_by":{"id":1,"name":"root"}}}`
	if string(resp.Data) != want {
		t.Fatalf("detail\n got %s\nwant %s", resp.Data, want)
	}
	resp = env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users/6", As: &env.staff})
	want = `{"id":6,"name":"six","email":"six@example.test","avatar":null,"cover":null,"role":1,"status":1,"lang":"ja","content_limit":1,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z","last_login_at":null,"two_factor_enabled":false,"sponsor_expires_at":null,"counts":{"comments":0,"resources":0,"favorites":0,"edits":0},"latest_ban":null}`
	if string(resp.Data) != want {
		t.Fatalf("detail without quota\n got %s\nwant %s", resp.Data, want)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users/99", As: &env.staff}), http.StatusNotFound, 300101)
}

func TestAdminUserProfile(t *testing.T) {
	env := newUserEnv(t)
	path := env.path(env.member.ID, "/profile")
	resp := env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{}})
	env.server.Expect(resp, http.StatusOK, 0)
	if want := `{"id":1,"name":"member","email":"member@example.test"}`; string(resp.Data) != want {
		t.Fatalf("no-op\n got %s\nwant %s", resp.Data, want)
	}
	resp = env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"name": "renamed", "lang": "ja", "content_limit": 3}})
	env.server.Expect(resp, http.StatusOK, 0)
	if want := `{"id":1,"name":"renamed","email":"member@example.test","lang":"ja","content_limit":3}`; string(resp.Data) != want {
		t.Fatalf("changed\n got %s\nwant %s", resp.Data, want)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"name": "peer"}}), http.StatusConflict, 300103)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"email": "peer@example.test"}}), http.StatusConflict, 300102)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"email": "nope"}}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"content_limit": 4}}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(env.peer.ID, "/profile"), As: &env.staff, Body: map[string]any{"lang": "zh"}}), http.StatusUnauthorized, 200101)
}

func TestAdminUserRole(t *testing.T) {
	env := newUserEnv(t)
	path := env.path(env.member.ID, "/role")
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"role": 2}}), http.StatusUnauthorized, 200101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(env.owner.UserID, "/role"), As: &env.owner, Body: map[string]any{"role": 2}}), http.StatusUnauthorized, 200101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.owner, Body: map[string]any{"role": 4}}), http.StatusUnprocessableEntity, 100101)
	resp := env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.owner, Body: map[string]any{"role": 2}})
	env.server.Expect(resp, http.StatusOK, 0)
	if role, _ := env.store.Role(env.member.ID); role != actor.RoleAdmin || resp.HasData {
		t.Fatalf("role: %v %s", role, resp.Body)
	}
}

func TestAdminUserBanUnbanAndSessions(t *testing.T) {
	env := newUserEnv(t)
	ban := env.path(env.member.ID, "/ban")
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: ban, As: &env.staff, Body: map[string]any{}}), http.StatusUnprocessableEntity, 300111)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(env.peer.ID, "/ban"), As: &env.staff, Body: map[string]any{"is_permanent": true}}), http.StatusUnauthorized, 200101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(env.staff.UserID, "/ban"), As: &env.staff, Body: map[string]any{"is_permanent": true}}), http.StatusUnauthorized, 200101)
	resp := env.server.Do(apitest.Request{Method: http.MethodPost, Path: ban, As: &env.staff, Body: map[string]any{"banned_by": 999, "banned_reason": "spam", "banned_duration_days": 7}})
	env.server.Expect(resp, http.StatusCreated, 0)
	if !env.accounts.User(env.member.ID).Banned() || resp.HasData {
		t.Fatalf("ban: %s", resp.Body)
	}
	if reason, _ := env.sessions.Revoked(env.member.ID); reason != "user_banned" {
		t.Fatalf("sessions: %q", reason)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: ban, As: &env.staff, Body: map[string]any{"is_permanent": true}}), http.StatusConflict, 300109)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(env.member.ID, "/unban"), As: &env.staff}), http.StatusCreated, 0)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(env.member.ID, "/unban"), As: &env.staff}), http.StatusConflict, 300110)

	resp = env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(env.peer.ID, "/force-logout"), As: &env.owner})
	env.server.Expect(resp, http.StatusCreated, 0)
	if reason, _ := env.sessions.Revoked(env.peer.ID); reason != admin.ReasonForceLogout || resp.HasData {
		t.Fatalf("force logout: %q %s", reason, resp.Body)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(99, "/force-logout"), As: &env.owner}), http.StatusNotFound, 300101)
}

func TestAdminUserResetPassword(t *testing.T) {
	env := newUserEnv(t)
	path := env.path(env.member.ID, "/reset-password")
	resp := env.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &env.staff, Body: map[string]any{"password": "lowercase1"}})
	env.server.Expect(resp, http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &env.staff, Body: map[string]any{"password": "Sh0rt"}}), http.StatusUnprocessableEntity, 100101)
	resp = env.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &env.staff, Body: map[string]any{"password": "Secret12"}})
	env.server.Expect(resp, http.StatusCreated, 0)
	if hash := env.accounts.User(env.member.ID).PasswordHash; hash == nil || *hash != "hash:Secret12" {
		t.Fatalf("password: %v", hash)
	}
	if reason, _ := env.sessions.Revoked(env.member.ID); reason != admin.ReasonResetPassword {
		t.Fatalf("sessions: %q", reason)
	}
}

func TestAdminUserSessionsShape(t *testing.T) {
	env := newUserEnv(t)
	env.store.AddSession(admin.Session{ID: 1, FamilyID: "fam-1", Status: auth.SessionActive, IP: ptr("1.2.3.4"), Created: stamp, Updated: stamp, ExpiresAt: stamp.Add(time.Hour)})
	env.store.AddSession(admin.Session{ID: 2, FamilyID: "fam-2", Status: auth.SessionBlocked, Created: stamp, Updated: stamp, ExpiresAt: stamp, BlockedAt: &stamp, BlockedReason: ptr("admin_force_logout")})
	resp := env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users/1/sessions?page=1&pageSize=5&status=4", As: &env.staff})
	env.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":2,"family_id":"fam-2","status":4,"ip":null,"user_agent":null,"device_info":null,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z","last_used_at":null,"expires_at":"2026-01-02T03:04:05.000Z","rotated_at":null,"reused_at":null,"blocked_at":"2026-01-02T03:04:05.000Z","blocked_reason":"admin_force_logout"}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":5,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("sessions\n got %s\nwant %s", resp.Data, want)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/users/1/sessions?status=5", As: &env.staff}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminUserPermissions(t *testing.T) {
	env := newUserEnv(t)
	env.permissions.SetRoleMask(actor.RoleUser, admin.PermissionGame, 3)
	env.permissions.SetMappings(admin.PermissionGame,
		admin.PermissionMapping{Field: "IDS", BitIndex: 0},
		admin.PermissionMapping{Field: "MANAGE_LINKS", BitIndex: 10, IsRelation: true},
	)
	path := env.path(env.member.ID, "/permissions")
	resp := env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"entity": "game", "allowBits": []int{10}}})
	env.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"allowMask":"1024"}` {
		t.Fatalf("set: %s", resp.Data)
	}
	resp = env.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?entity=game", As: &env.staff})
	env.server.Expect(resp, http.StatusOK, 0)
	want := `{"entity":"game","roleMask":"3","userMask":"1024","allowMask":"1027","groups":[{"field":"IDS","bitIndex":0,"isRelation":false,"fields":["v_id","b_id"],"enabled":true,"source":"role","mutable":false},{"field":"MANAGE_LINKS","bitIndex":10,"isRelation":true,"fields":["links"],"enabled":true,"source":"user","mutable":true}]}`
	if string(resp.Data) != want {
		t.Fatalf("permissions\n got %s\nwant %s", resp.Data, want)
	}
	invalid := env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"entity": "game", "allowBits": []int{3}}})
	env.server.Expect(invalid, http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"entity": "game", "allowBits": []int{10, 10}}}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &env.staff}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: env.path(env.peer.ID, "/permissions?entity=game"), As: &env.staff}), http.StatusUnauthorized, 200101)
	resp = env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"entity": "game"}})
	if env.server.Expect(resp, http.StatusOK, 0); string(resp.Data) != `{"allowMask":"0"}` {
		t.Fatalf("clear: %s", resp.Data)
	}
}

func TestAdminUserQuota(t *testing.T) {
	env := newUserEnv(t)
	id := env.member.ID
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(id, "/quota/size"), As: &env.staff, Body: map[string]any{"action": "ADD", "amount": 100}}), http.StatusOK, 0)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(id, "/quota/used"), As: &env.staff, Body: map[string]any{"action": "USE", "amount": 60, "action_reason": "manual"}}), http.StatusOK, 0)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(id, "/quota/size"), As: &env.staff, Body: map[string]any{"action": "SUB", "amount": 41}}), http.StatusConflict, 500102)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(id, "/quota/used"), As: &env.staff, Body: map[string]any{"action": "ADD", "amount": 61}}), http.StatusConflict, 500103)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(id, "/quota/used"), As: &env.staff, Body: map[string]any{"action": "SUB", "amount": 1}}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(id, "/quota/size"), As: &env.staff, Body: map[string]any{"action": "ADD", "amount": 0}}), http.StatusUnprocessableEntity, 100101)
	if quota := env.quotas.Quota(id); quota.Size != 100 || quota.Used != 60 {
		t.Fatalf("quota: %+v", quota)
	}
	resp := env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(id, "/quota/reset-used"), As: &env.staff})
	env.server.Expect(resp, http.StatusCreated, 0)
	if quota := env.quotas.Quota(id); quota.Used != 0 || resp.HasData {
		t.Fatalf("reset: %+v %s", quota, resp.Body)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPost, Path: env.path(env.peer.ID, "/quota/reset-used"), As: &env.staff}), http.StatusUnauthorized, 200101)
}

func TestAdminUserSponsor(t *testing.T) {
	env := newUserEnv(t)
	path := env.path(env.peer.ID, "/sponsor")
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"sponsor_expires_at": "2027-01-01T00:00:00+08:00"}}), http.StatusOK, 0)
	if at, _ := env.store.Sponsor(env.peer.ID); at == nil || !at.Equal(time.Date(2026, 12, 31, 16, 0, 0, 0, time.UTC)) {
		t.Fatalf("sponsor: %v", at)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{}}), http.StatusOK, 0)
	if at, ok := env.store.Sponsor(env.peer.ID); !ok || at != nil {
		t.Fatalf("an empty body clears the badge: %v", at)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"sponsor_expires_at": nil}}), http.StatusOK, 0)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &env.staff, Body: map[string]any{"sponsor_expires_at": "tomorrow"}}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: env.path(99, "/sponsor"), As: &env.staff, Body: map[string]any{}}), http.StatusNotFound, 300101)
}
