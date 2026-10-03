package adminpg_test

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/adminpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/editrecord"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/fieldpermissionmapping"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/rolefieldpermission"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func entryIDs(entries []admin.UserEntry) []int {
	ids := make([]int, len(entries))
	for i, entry := range entries {
		ids[i] = entry.ID
	}
	return ids
}

func TestSearchUsersFiltersAndCounts(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := adminpg.NewUserStore(db.Ent)
	alice := db.Ent.User.Create().SetName("Alice").SetEmail("alice@mail.test").SetContentLimit(1).SaveX(ctx)
	bob := db.Ent.User.Create().SetName("bob").SetEmail("bob@shion.test").SetContentLimit(2).SetRole(2).SaveX(ctx)
	carol := db.Ent.User.Create().SetName("carol").SetEmail("carol@mail.test").SetContentLimit(1).SetStatus(2).SaveX(ctx)
	gameID := db.Game(t)
	content := json.RawMessage(`{"root":{}}`)
	for range 2 {
		db.Ent.Comment.Create().SetContent(content).SetGameID(gameID).SetCreatorID(alice.ID).SaveX(ctx)
	}
	db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(alice.ID).SetStatus(2).SaveX(ctx)
	db.Ent.Favorite.Create().SetUserID(alice.ID).SetName("default").SaveX(ctx)
	db.Ent.EditRecord.Create().SetEntity(editrecord.EntityGame).SetTargetID(gameID).SetAction(editrecord.ActionUPDATE_SCALAR).SetActorID(alice.ID).SetActorRole(1).SaveX(ctx)

	page := admin.Page{Number: 1, Size: 10}
	entries, total, err := store.SearchUsers(ctx, admin.UserFilter{Search: "MAIL.TEST", SortBy: admin.UserSortByName}, page)
	if err != nil || total != 2 || !slices.Equal(entryIDs(entries), []int{alice.ID, carol.ID}) {
		t.Fatalf("email search: %v %d %v", entryIDs(entries), total, err)
	}
	if got := entries[0].Counts; got != (admin.Counts{Comments: 2, Resources: 1, Favorites: 1, Edits: 1}) {
		t.Fatalf("counts: %+v", got)
	}
	if got := entries[1].Counts; got != (admin.Counts{}) {
		t.Fatalf("users without contributions: %+v", got)
	}
	entries, _, _ = store.SearchUsers(ctx, admin.UserFilter{Search: strconv.Itoa(bob.ID)}, page)
	if !slices.Contains(entryIDs(entries), bob.ID) {
		t.Fatalf("numeric search matches ids: %v", entryIDs(entries))
	}
	if _, total, err := store.SearchUsers(ctx, admin.UserFilter{Search: "99999999999"}, page); err != nil || total != 0 {
		t.Fatalf("ids beyond int32 are only matched as text: %d %v", total, err)
	}
	role, banned := actor.RoleAdmin, user.StatusBanned
	if entries, total, _ := store.SearchUsers(ctx, admin.UserFilter{Role: &role}, page); total != 1 || entries[0].ID != bob.ID || entries[0].Role != role || entries[0].ContentLimit != 2 {
		t.Fatalf("role filter: %+v", entries)
	}
	if entries, total, _ := store.SearchUsers(ctx, admin.UserFilter{Status: &banned}, page); total != 1 || entries[0].ID != carol.ID {
		t.Fatalf("status filter: %+v", entries)
	}
	entries, total, _ = store.SearchUsers(ctx, admin.UserFilter{SortBy: admin.UserSortByID, Descending: true}, admin.Page{Number: 1, Size: 2})
	creator := db.Ent.Game.GetX(ctx, gameID).CreatorID
	if total != 4 || !slices.Equal(entryIDs(entries), []int{creator, carol.ID}) {
		t.Fatalf("pagination: %v %d", entryIDs(entries), total)
	}
}

func TestUserDetailLoadsQuotaAndLatestBan(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := adminpg.NewUserStore(db.Ent)
	target, moderator := db.User(t), db.User(t)
	if _, err := store.UserDetail(ctx, 987654); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
	detail, err := store.UserDetail(ctx, target)
	if err != nil || detail.Quota != nil || detail.LatestBan != nil || detail.ID != target {
		t.Fatalf("bare user: %+v %v", detail, err)
	}
	db.Ent.UserUploadQuota.Create().SetUserID(target).SetSize(1 << 40).SetUsed(5).SetIsFirstGrant(true).SaveX(ctx)
	older := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	newer := older.Add(time.Hour)
	db.Ent.UserBannedRecord.Create().SetUserID(target).SetBannedAt(older).SetIsPermanent(true).SaveX(ctx)
	db.Ent.UserBannedRecord.Create().SetUserID(target).SetBannedAt(newer).SetBannedBy(moderator).SetBannedReason("spam").SetBannedDurationDays(3).SaveX(ctx)
	detail, err = store.UserDetail(ctx, target)
	if err != nil || detail.Quota == nil || *detail.Quota != (admin.Quota{Size: 1 << 40, Used: 5, IsFirstGrant: true}) {
		t.Fatalf("quota: %+v %v", detail.Quota, err)
	}
	ban := detail.LatestBan
	if ban == nil || !ban.BannedAt.Equal(newer) || ban.Reason == nil || *ban.Reason != "spam" || ban.DurationDays == nil || *ban.DurationDays != 3 || ban.Permanent || ban.BannedBy == nil || ban.BannedBy.ID != moderator || ban.BannedBy.Name == "" {
		t.Fatalf("latest ban: %+v", ban)
	}
}

func TestRoleSponsorAndSessions(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := adminpg.NewUserStore(db.Ent)
	target := db.User(t)
	if err := store.SetRole(ctx, target, actor.RoleAdmin); err != nil {
		t.Fatal(err)
	}
	until := time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)
	if err := store.SetSponsorExpiry(ctx, target, &until); err != nil {
		t.Fatal(err)
	}
	row := db.Ent.User.GetX(ctx, target)
	if row.Role != 2 || row.SponsorExpiresAt == nil || !row.SponsorExpiresAt.Equal(until) {
		t.Fatalf("user: %+v", row)
	}
	if err := store.SetSponsorExpiry(ctx, target, nil); err != nil {
		t.Fatal(err)
	}
	if row = db.Ent.User.GetX(ctx, target); row.SponsorExpiresAt != nil {
		t.Fatalf("sponsor cleared: %v", row.SponsorExpiresAt)
	}
	if err := store.SetRole(ctx, 987654, actor.RoleAdmin); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}

	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for i, status := range []int{1, 4, 1} {
		db.Ent.UserLoginSession.Create().SetUserID(target).SetRefreshTokenHash("h").SetRefreshTokenPrefix("p" + string(rune('a'+i))).
			SetStatus(status).SetExpiresAt(base.Add(48 * time.Hour)).SetCreated(base.Add(time.Duration(i) * time.Hour)).SaveX(ctx)
	}
	sessions, total, err := store.Sessions(ctx, admin.SessionFilter{UserID: target}, admin.Page{Number: 1, Size: 2})
	if err != nil || total != 3 || len(sessions) != 2 || !sessions[0].Created.Equal(base.Add(2*time.Hour)) || sessions[0].FamilyID == "" {
		t.Fatalf("newest first: %+v %d %v", sessions, total, err)
	}
	blocked := auth.SessionBlocked
	sessions, total, _ = store.Sessions(ctx, admin.SessionFilter{UserID: target, Status: &blocked}, admin.Page{Number: 1, Size: 10})
	if total != 1 || sessions[0].Status != blocked {
		t.Fatalf("status filter: %+v", sessions)
	}
	if _, total, _ := store.Sessions(ctx, admin.SessionFilter{UserID: 987654}, admin.Page{Number: 1, Size: 10}); total != 0 {
		t.Fatalf("unknown users have no sessions: %d", total)
	}
}

func TestPermissionStore(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := adminpg.NewPermissionStore(db.Ent)
	target := db.User(t)
	db.Ent.RoleFieldPermission.Delete().ExecX(ctx)
	db.Ent.FieldPermissionMapping.Delete().ExecX(ctx)
	db.Ent.RoleFieldPermission.Create().SetRole(1).SetEntity(rolefieldpermission.EntityGame).SetAllowMask(3).SaveX(ctx)
	for _, m := range []struct {
		field    string
		bit      int
		relation bool
	}{{"TITLES", 1, false}, {"IDS", 0, false}, {"MANAGE_LINKS", 10, true}} {
		db.Ent.FieldPermissionMapping.Create().SetEntity(fieldpermissionmapping.EntityGame).SetField(m.field).SetBitIndex(m.bit).SetIsRelation(m.relation).SaveX(ctx)
	}
	db.Ent.FieldPermissionMapping.Create().SetEntity(fieldpermissionmapping.EntityDeveloper).SetField("NAME").SetBitIndex(1).SaveX(ctx)

	if mask, err := store.RoleMask(ctx, actor.RoleUser, admin.PermissionGame); err != nil || mask != 3 {
		t.Fatalf("role mask: %d %v", mask, err)
	}
	if mask, err := store.RoleMask(ctx, actor.RoleAdmin, admin.PermissionGame); err != nil || mask != 0 {
		t.Fatalf("missing role mask: %d %v", mask, err)
	}
	mappings, err := store.PermissionMappings(ctx, admin.PermissionGame)
	want := []admin.PermissionMapping{{Field: "IDS", BitIndex: 0}, {Field: "TITLES", BitIndex: 1}, {Field: "MANAGE_LINKS", BitIndex: 10, IsRelation: true}}
	if err != nil || !slices.Equal(mappings, want) {
		t.Fatalf("mappings: %+v %v", mappings, err)
	}
	if mask, err := store.UserMask(ctx, target, admin.PermissionGame); err != nil || mask != 0 {
		t.Fatalf("missing user mask: %d %v", mask, err)
	}
	for _, mask := range []int64{1 << 10, 1} {
		if err := store.SetUserMask(ctx, target, admin.PermissionGame, mask); err != nil {
			t.Fatal(err)
		}
		if got, err := store.UserMask(ctx, target, admin.PermissionGame); err != nil || got != mask {
			t.Fatalf("user mask is replaced: %d %v", got, err)
		}
	}
	if count := db.Ent.UserFieldPermission.Query().CountX(ctx); count != 1 {
		t.Fatalf("one row per user and entity: %d", count)
	}
	if err := store.SetUserMask(ctx, 987654, admin.PermissionGame, 1); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
}

func TestMigrationsSeedTheLegacyEditPermissions(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	store := adminpg.NewPermissionStore(db.Ent)
	want := map[admin.PermissionEntity][3]int64{
		admin.PermissionGame:      {718, 270334, 524287},
		admin.PermissionCharacter: {494, 510, 511},
		admin.PermissionDeveloper: {94, 126, 127},
	}
	for entity, masks := range want {
		for i, role := range []actor.Role{actor.RoleUser, actor.RoleAdmin, actor.RoleSuperAdmin} {
			if mask, err := store.RoleMask(ctx, role, entity); err != nil || mask != masks[i] {
				t.Fatalf("%s role %d mask %d %v, want %d", entity, role, mask, err, masks[i])
			}
		}
	}
	game, err := store.PermissionMappings(ctx, admin.PermissionGame)
	if err != nil || len(game) != 19 || game[18] != (admin.PermissionMapping{Field: "MANAGE_RELATIONS", BitIndex: 18, IsRelation: true}) {
		t.Fatalf("game mappings %+v %v", game, err)
	}
	if characters, err := store.PermissionMappings(ctx, admin.PermissionCharacter); err != nil || len(characters) != 9 {
		t.Fatalf("character mappings %+v %v", characters, err)
	}
	if developers, err := store.PermissionMappings(ctx, admin.PermissionDeveloper); err != nil || len(developers) != 7 {
		t.Fatalf("developer mappings %+v %v", developers, err)
	}
}
