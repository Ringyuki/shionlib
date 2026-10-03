package main

import (
	"bytes"
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/argon2hash"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/keybox"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsourcelink"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestE2EPrepareReproducesTheLegacyDatasetIdempotently(t *testing.T) {
	db := pgtest.New(t)
	cache := redistest.New(t)
	ctx := context.Background()
	hasher := argon2hash.New(argon2hash.Params{Memory: 1024, Iterations: 1, Parallelism: 1})
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	if err := cache.Set(ctx, cache.Key("stale"), "1", 0).Err(); err != nil {
		t.Fatal(err)
	}
	keys, err := keybox.NewBox(strings.Repeat("e2e-key-", 5))
	if err != nil {
		t.Fatal(err)
	}
	seeder := newE2ESeeder(e2eSeederDeps{
		SQL:      db.SQL,
		Redis:    cache,
		Keys:     keys,
		Hasher:   hasher,
		Password: e2eDefaultPassword,
		Now:      func() time.Time { return now },
		Out:      &bytes.Buffer{},
	})

	first, err := seeder.Prepare(ctx)
	if err != nil {
		t.Fatalf("first prepare: %v", err)
	}
	second, err := seeder.Prepare(ctx)
	if err != nil {
		t.Fatalf("second prepare: %v", err)
	}

	for _, result := range []e2eSeedResult{first, second} {
		if !slices.Equal(result.UserIDs, []int{1, 2, 3, 4, 5, 6, 7, 8}) || !slices.Equal(result.GameIDs, []int{1, 2, 3, 4, 5, 6}) {
			t.Fatalf("identities restart on every prepare: %+v", result)
		}
		if result.PrimaryGameID != 1 || result.MalwareGameID != 3 {
			t.Fatalf("primary and malware games: %+v", result)
		}
	}

	counts := map[string]int{
		"users":                        8,
		"user_upload_quotas":           8,
		"favorites":                    8,
		"favorite_items":               1,
		"field_permission_mappings":    34,
		"game_developers":              3,
		"game_characters":              48,
		"games":                        6,
		"game_covers":                  4,
		"game_images":                  30,
		"game_links":                   14,
		"game_developer_relations":     3,
		"game_character_relations":     48,
		"comments":                     2,
		"activities":                   3,
		"game_download_resources":      2,
		"game_download_resource_files": 2,
		"malware_scan_cases":           1,
		"catalog_source_links":         6,
	}
	for table, want := range counts {
		var got int
		if err := db.SQL.QueryRowContext(ctx, "SELECT count(*) FROM "+table).Scan(&got); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if got != want {
			t.Errorf("%s: got %d rows, want %d", table, got, want)
		}
	}

	admin := db.Ent.User.Query().Where(user.Name("e2e_admin")).OnlyX(ctx)
	if admin.Role != 3 || admin.ContentLimit != 3 || admin.Email != "e2e_admin@shionlib.local" {
		t.Fatalf("admin user: %+v", admin)
	}
	if ok, err := hasher.Verify(*admin.Password, e2eDefaultPassword); err != nil || !ok {
		t.Fatalf("seeded password verifies: %v %v", ok, err)
	}
	listAll := db.Ent.User.Query().Where(user.Name("e2e_list_all_user")).OnlyX(ctx)
	if listAll.OnlyGamesWithResources || listAll.ContentLimit != 3 {
		t.Fatalf("list-all user sees every game: %+v", listAll)
	}

	primary := db.Ent.Game.Query().Where(game.ID(1)).OnlyX(ctx)
	if primary.TitleEn != "HAMIDASHI CREATIVE Re:Re:call" || primary.HID == nil || *primary.HID != 1 || primary.CreatorID != admin.ID {
		t.Fatalf("primary game: %+v", primary)
	}
	if db.Ent.CatalogSourceLink.Query().Where(catalogsourcelink.Source("hikarinagi"), catalogsourcelink.ExternalID("1"), catalogsourcelink.LocalID(1)).CountX(ctx) != 1 {
		t.Fatal("games are linked to their source like the cutover backfill")
	}
	root := db.Ent.Comment.Query().Where(comment.HTML("<p>Seeded root comment for E2E.</p>")).OnlyX(ctx)
	if root.ReplyCount != 1 || root.GameID != 1 {
		t.Fatalf("root comment: %+v", root)
	}

	var tags []string
	rows, err := db.SQL.QueryContext(ctx, `SELECT t.name FROM game_tag_relations r JOIN tags t ON t.id = r.tag_id WHERE r.game_id = 1 ORDER BY t.id`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		_ = rows.Close()
	}()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		tags = append(tags, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(tags, []string{"galgame", "まどそふと"}) {
		t.Fatalf("first two tags are normalized: %v", tags)
	}

	if exists, _ := cache.Exists(ctx, cache.Key("stale")).Result(); exists != 0 {
		t.Fatal("reset removes keys under the prefix")
	}
	recent, err := cache.ZRangeArgs(ctx, goredis.ZRangeArgs{Key: cache.Key("game:recent_update"), Start: 0, Stop: -1, Rev: true}).Result()
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(recent, []string{"1", "2", "3", "4", "5", "6"}) {
		t.Fatalf("recent updates keep the seeded order: %v", recent)
	}
}
