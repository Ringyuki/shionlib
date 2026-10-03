package catalogpg_test

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/catalogpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsourcelink"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloper"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamerelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/tag"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog/catalogtest"
)

var syncedAt = time.Date(2026, 10, 3, 8, 0, 0, 0, time.UTC)

func ptr[T any](value T) *T {
	return &value
}

func fullGame() catalog.GameRecord {
	release := time.Date(2020, 4, 24, 0, 0, 0, 0, time.UTC)
	return catalog.GameRecord{
		ExternalID:   "77",
		HikarinagiID: ptr(77),
		VID:          ptr("v4242"),
		BID:          ptr("1234"),
		TitleJP:      "サクラノ詩",
		TitleZH:      "樱之诗",
		TitleEN:      "Sakura no Uta",
		IntroJP:      "あらすじ",
		IntroZH:      "简介",
		Aliases:      []string{"sakuuta"},
		ReleaseDate:  &release,
		Type:         ptr("ADV"),
		Platforms:    []string{"win"},
		NSFW:         true,
		Staffs:       []catalog.Staff{{Name: "すかぢ", Role: "剧本"}},
		Covers: []catalog.CoverRecord{
			{Language: "jp", Type: "pkgfront", URL: "https://cdn.test/a.webp", Dims: []int{800, 1200}, SourceKey: "0"},
			{Language: "zh", Type: "dig", URL: "https://cdn.test/b.webp", Sexual: 2, SourceKey: "1"},
		},
		Images:     []catalog.ImageRecord{{URL: "https://cdn.test/s1.webp", Dims: []int{1280, 720}, SourceKey: "0"}},
		Links:      []catalog.Link{{Name: "official", Label: "官网", URL: "https://example.test"}},
		Tags:       []string{"纯爱", "艺术"},
		Developers: []catalog.DeveloperLink{{ExternalID: "5", HikarinagiID: ptr(5), Name: "枕", Role: "开发"}},
		Characters: []catalog.CharacterLink{{ExternalID: "9", HikarinagiID: ptr(9), NameJP: "御桜稟", NameZH: ptr("御樱禀"), Image: ptr("https://cdn.test/c.webp"), Role: "main", Actor: ptr("有栖川みや美")}},
		Revision:   "2026-09-01T00:00:00Z",
	}
}

func TestApplyGameWritesTheWholeCatalogEntry(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	store := catalogpg.NewStore(db.Ent)
	creator := db.User(t)

	id, related, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), creator, syncedAt)
	if err != nil {
		t.Fatal(err)
	}
	wantRelated := []catalog.Ref{
		{Source: catalog.SourceHikarinagi, Entity: catalog.EntityDeveloper, ExternalID: "5"},
		{Source: catalog.SourceHikarinagi, Entity: catalog.EntityCharacter, ExternalID: "9"},
	}
	if !slices.Equal(related, wantRelated) {
		t.Fatalf("related %v", related)
	}

	row, err := db.Ent.Game.Query().Where(entgame.ID(id)).
		WithCovers(func(q *ent.GameCoverQuery) { q.Order(ent.Asc(gamecover.FieldID)) }).
		WithImages().WithLink().WithTags().
		WithDevelopers(func(q *ent.GameDeveloperRelationQuery) { q.WithDeveloper() }).
		WithCharacters(func(q *ent.GameCharacterRelationQuery) { q.WithCharacter() }).
		Only(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if row.CreatorID != creator || row.HID == nil || *row.HID != 77 || *row.VID != "v4242" || *row.BID != "1234" || row.Status != 1 {
		t.Fatalf("identity columns %+v", row)
	}
	if row.TitleJp != "サクラノ詩" || row.TitleZh != "樱之诗" || row.TitleEn != "Sakura no Uta" || row.IntroZh != "简介" || !row.Nsfw || *row.Type != "ADV" {
		t.Fatalf("metadata columns %+v", row)
	}
	if !slices.Equal([]string(row.Aliases), []string{"sakuuta"}) || !slices.Equal([]string(row.Platform), []string{"win"}) || row.ReleaseDate == nil || !row.ReleaseDate.Equal(time.Date(2020, 4, 24, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("list columns %+v", row)
	}
	var staffs []map[string]string
	if err := json.Unmarshal(row.Staffs, &staffs); err != nil || len(staffs) != 1 || staffs[0]["name"] != "すかぢ" || staffs[0]["role"] != "剧本" {
		t.Fatalf("staffs %s %v", row.Staffs, err)
	}
	covers := row.Edges.Covers
	if len(covers) != 2 || covers[0].URL != "https://cdn.test/a.webp" || covers[0].Language != "jp" || covers[0].Type != "pkgfront" || !slices.Equal([]int(covers[0].Dims), []int{800, 1200}) || covers[1].Sexual != 2 {
		t.Fatalf("covers %+v", covers)
	}
	if covers[0].Source == nil || *covers[0].Source != catalog.SourceHikarinagi || covers[0].SourceKey == nil || *covers[0].SourceKey != "0" {
		t.Fatalf("cover provenance %+v", covers[0])
	}
	if len(row.Edges.Images) != 1 || len(row.Edges.Link) != 1 || row.Edges.Link[0].Label != "官网" {
		t.Fatalf("images/links %+v %+v", row.Edges.Images, row.Edges.Link)
	}
	if len(row.Edges.Tags) != 2 {
		t.Fatalf("tags %+v", row.Edges.Tags)
	}
	developers := row.Edges.Developers
	if len(developers) != 1 || *developers[0].Role != "开发" || developers[0].Edges.Developer.Name != "枕" || *developers[0].Edges.Developer.HID != 5 {
		t.Fatalf("developers %+v", developers)
	}
	characters := row.Edges.Characters
	if len(characters) != 1 || *characters[0].Role != gamecharacterrelation.RoleMain || *characters[0].Actor != "有栖川みや美" || *characters[0].Image != "https://cdn.test/c.webp" {
		t.Fatalf("characters %+v", characters)
	}
	if character := characters[0].Edges.Character; character.NameJp != "御桜稟" || *character.NameZh != "御樱禀" || *character.HID != 9 {
		t.Fatalf("character placeholder %+v", character)
	}
	link, err := db.Ent.CatalogSourceLink.Query().Where(catalogsourcelink.Entity("game"), catalogsourcelink.ExternalID("77")).Only(ctx)
	if err != nil || link.LocalID != id || link.SyncedAt == nil || !link.SyncedAt.Equal(syncedAt) || link.Revision == nil || *link.Revision != "2026-09-01T00:00:00Z" {
		t.Fatalf("link %+v %v", link, err)
	}
	counts, err := db.Ent.Tag.Query().Where(tag.NameIn("纯爱", "艺术")).Select(tag.FieldCount).Ints(ctx)
	if err != nil || !slices.Equal(counts, []int{1, 1}) {
		t.Fatalf("tag counts %v %v", counts, err)
	}
}

func TestReapplyReplacesChildRowsAndRecountsTags(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	store := catalogpg.NewStore(db.Ent)
	creator := db.User(t)
	first := fullGame()
	id, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, first, creator, syncedAt)
	if err != nil {
		t.Fatal(err)
	}
	second := fullGame()
	second.Tags = []string{"纯爱"}
	second.Covers = second.Covers[:1]
	second.Developers = nil
	second.ReleaseDate = nil
	second.Type = nil
	again, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, second, creator, syncedAt.Add(time.Hour))
	if err != nil || again != id {
		t.Fatalf("reapply %d %v", again, err)
	}
	row, err := db.Ent.Game.Query().Where(entgame.ID(id)).WithCovers().WithTags().WithDevelopers().Only(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(row.Edges.Covers) != 1 || len(row.Edges.Tags) != 1 || len(row.Edges.Developers) != 0 || row.ReleaseDate != nil || row.Type != nil {
		t.Fatalf("children were not replaced: %+v", row)
	}
	art, err := db.Ent.Tag.Query().Where(tag.Name("艺术")).Only(ctx)
	if err != nil || art.Count != 0 {
		t.Fatalf("dropped tag must be recounted: %+v %v", art, err)
	}
	if games, err := db.Ent.Game.Query().Count(ctx); err != nil || games != 1 {
		t.Fatalf("reapply must not create games: %d %v", games, err)
	}
	if developers, err := db.Ent.GameDeveloper.Query().Count(ctx); err != nil || developers != 1 {
		t.Fatalf("developer placeholders are kept: %d %v", developers, err)
	}
}

func TestApplyGameAdoptsExistingRows(t *testing.T) {
	ctx := context.Background()

	t.Run("by hikarinagi id", func(t *testing.T) {
		db := pgtest.New(t)
		store := catalogpg.NewStore(db.Ent)
		existing := db.Game(t, func(c *ent.GameCreate) { c.SetHID(77).SetViews(12) })
		id, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
		if err != nil || id != existing {
			t.Fatalf("adopted %d %v, want %d", id, err, existing)
		}
		row, err := db.Ent.Game.Get(ctx, id)
		if err != nil || row.Views != 12 || row.TitleZh != "樱之诗" {
			t.Fatalf("adopted row %+v %v", row, err)
		}
	})

	t.Run("by a unique unlinked vndb id", func(t *testing.T) {
		db := pgtest.New(t)
		store := catalogpg.NewStore(db.Ent)
		existing := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v4242") })
		id, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
		if err != nil || id != existing {
			t.Fatalf("adopted %d %v, want %d", id, err, existing)
		}
		row, err := db.Ent.Game.Get(ctx, id)
		if err != nil || row.HID == nil || *row.HID != 77 || *row.BID != "1234" {
			t.Fatalf("external ids were not filled in: %+v %v", row, err)
		}
	})

	t.Run("ambiguous external ids create a new row", func(t *testing.T) {
		db := pgtest.New(t)
		store := catalogpg.NewStore(db.Ent)
		first := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v4242") })
		second := db.Game(t, func(c *ent.GameCreate) { c.SetBID("1234") })
		id, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
		if err != nil || id == first || id == second {
			t.Fatalf("ambiguous match must not be adopted: %d %v", id, err)
		}
		row, err := db.Ent.Game.Get(ctx, id)
		if err != nil || row.HID == nil || *row.HID != 77 {
			t.Fatalf("new row %+v %v", row, err)
		}
	})

	t.Run("an external id pair owned by another game is left alone", func(t *testing.T) {
		db := pgtest.New(t)
		store := catalogpg.NewStore(db.Ent)
		owner := db.Game(t, func(c *ent.GameCreate) { c.SetBID("1234").SetVID("v4242") })
		if _, err := db.Ent.CatalogSourceLink.Create().SetSource(catalog.SourceHikarinagi).SetEntity("game").SetExternalID("12").SetLocalID(owner).Save(ctx); err != nil {
			t.Fatal(err)
		}
		id, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
		if err != nil || id == owner {
			t.Fatalf("apply %d %v", id, err)
		}
		row, err := db.Ent.Game.Get(ctx, id)
		if err != nil || row.BID != nil || row.VID != nil {
			t.Fatalf("pair must stay with its owner: %+v %v", row, err)
		}
	})

	t.Run("a link to a deleted row is replaced", func(t *testing.T) {
		db := pgtest.New(t)
		store := catalogpg.NewStore(db.Ent)
		id, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
		if err != nil {
			t.Fatal(err)
		}
		if err := db.Ent.Game.DeleteOneID(id).Exec(ctx); err != nil {
			t.Fatal(err)
		}
		recreated, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
		if err != nil || recreated == id {
			t.Fatalf("recreate %d %v", recreated, err)
		}
	})
}

func TestRelationsPointOnlyAtLinkedGames(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	store := catalogpg.NewStore(db.Ent)
	creator := db.User(t)
	sequel := catalog.GameRecord{ExternalID: "2", TitleJP: "続編", Relations: []catalog.RelationLink{{ExternalID: "1", Type: "PREQUEL"}, {ExternalID: "404", Type: "SEQUEL"}}}
	sequelID, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, sequel, creator, syncedAt)
	if err != nil {
		t.Fatal(err)
	}
	if count, err := db.Ent.GameRelation.Query().Count(ctx); err != nil || count != 0 {
		t.Fatalf("unlinked targets are skipped: %d %v", count, err)
	}
	original := catalog.GameRecord{ExternalID: "1", TitleJP: "本編", Relations: []catalog.RelationLink{{ExternalID: "2", Type: "SEQUEL"}}}
	originalID, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, original, creator, syncedAt)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, sequel, creator, syncedAt); err != nil {
		t.Fatal(err)
	}
	rows, err := db.Ent.GameRelation.Query().Order(ent.Asc(gamerelation.FieldFromGameID)).All(ctx)
	if err != nil || len(rows) != 2 {
		t.Fatalf("relations %+v %v", rows, err)
	}
	for _, row := range rows {
		switch row.FromGameID {
		case originalID:
			if row.ToGameID != sequelID || row.Relation != gamerelation.RelationSEQUEL {
				t.Fatalf("original relation %+v", row)
			}
		case sequelID:
			if row.ToGameID != originalID || row.Relation != gamerelation.RelationPREQUEL {
				t.Fatalf("sequel relation %+v", row)
			}
		default:
			t.Fatalf("unexpected relation %+v", row)
		}
	}
}

func TestApplyDeveloperAndCharacterFillPlaceholders(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	store := catalogpg.NewStore(db.Ent)
	gameID, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
	if err != nil {
		t.Fatal(err)
	}
	placeholder, err := db.Ent.GameDeveloper.Query().Where(gamedeveloper.HID(5)).Only(ctx)
	if err != nil {
		t.Fatal(err)
	}
	developerID, err := store.ApplyDeveloper(ctx, catalog.SourceHikarinagi, catalog.DeveloperRecord{
		ExternalID:   "5",
		HikarinagiID: ptr(5),
		VID:          ptr("p100"),
		Name:         "枕",
		Aliases:      []string{"Makura"},
		IntroZH:      "开发商",
		Website:      ptr("https://makura.test"),
		Extra:        []catalog.KeyValue{{Key: "country", Value: "JP"}},
	}, syncedAt)
	if err != nil || developerID != placeholder.ID {
		t.Fatalf("developer %d %v, want %d", developerID, err, placeholder.ID)
	}
	developer, err := db.Ent.GameDeveloper.Get(ctx, developerID)
	if err != nil || *developer.VID != "p100" || *developer.Website != "https://makura.test" || developer.IntroZh != "开发商" || !slices.Equal([]string(developer.Aliases), []string{"Makura"}) {
		t.Fatalf("developer row %+v %v", developer, err)
	}
	if string(developer.ExtraInfo) != `[{"key": "country", "value": "JP"}]` {
		t.Fatalf("developer extra %s", developer.ExtraInfo)
	}

	characterID, err := store.ApplyCharacter(ctx, catalog.SourceHikarinagi, catalog.CharacterRecord{
		ExternalID:   "9",
		HikarinagiID: ptr(9),
		NameJP:       "御桜稟",
		NameEN:       ptr("Rin"),
		IntroJP:      "紹介",
		BloodType:    ptr("a"),
		Height:       ptr(158),
		Birthday:     []int{4, 1},
		Gender:       []string{"f"},
	}, syncedAt)
	if err != nil {
		t.Fatal(err)
	}
	relation, err := db.Ent.GameCharacterRelation.Query().Where(gamecharacterrelation.GameID(gameID)).Only(ctx)
	if err != nil || relation.CharacterID != characterID {
		t.Fatalf("character apply must reuse the placeholder: %+v %v", relation, err)
	}
	character, err := db.Ent.GameCharacter.Get(ctx, characterID)
	if err != nil {
		t.Fatal(err)
	}
	if character.NameZh != nil || *character.NameEn != "Rin" || *character.BloodType != "a" || *character.Height != 158 || !slices.Equal([]int(character.Birthday), []int{4, 1}) || !slices.Equal([]string(character.Gender), []string{"f"}) {
		t.Fatalf("character row %+v", character)
	}
	if relation, err := db.Ent.GameDeveloperRelation.Query().Where(gamedeveloperrelation.GameID(gameID)).Only(ctx); err != nil || relation.DeveloperID != developerID {
		t.Fatalf("developer relation %+v %v", relation, err)
	}
	refs, err := store.Stale(ctx, catalog.SourceHikarinagi, syncedAt.Add(time.Minute), 10)
	if err != nil || len(refs) != 3 {
		t.Fatalf("all synced links become stale after the interval: %v %v", refs, err)
	}
}

func TestMarkMissingHidesGamesAndRecordFailureCountsErrors(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	store := catalogpg.NewStore(db.Ent)
	id, _, err := store.ApplyGame(ctx, catalog.SourceHikarinagi, fullGame(), db.User(t), syncedAt)
	if err != nil {
		t.Fatal(err)
	}
	ref := catalog.Ref{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "77"}
	if err := store.RecordFailure(ctx, ref, strings.Repeat("x", 900), syncedAt); err != nil {
		t.Fatal(err)
	}
	truncated, err := db.Ent.CatalogSourceLink.Query().Where(catalogsourcelink.LocalID(id), catalogsourcelink.Entity("game")).Only(ctx)
	if err != nil || len(*truncated.LastError) != 500 {
		t.Fatalf("errors are truncated: %+v %v", truncated, err)
	}
	if err := store.RecordFailure(ctx, ref, "boom", syncedAt); err != nil {
		t.Fatal(err)
	}
	if err := store.MarkMissing(ctx, ref, true, syncedAt); err != nil {
		t.Fatal(err)
	}
	link, err := db.Ent.CatalogSourceLink.Query().Where(catalogsourcelink.LocalID(id), catalogsourcelink.Entity("game")).Only(ctx)
	if err != nil || link.Failures != 2 || *link.LastError != "boom" || link.MissingAt == nil {
		t.Fatalf("link %+v %v", link, err)
	}
	row, err := db.Ent.Game.Get(ctx, id)
	if err != nil || row.Status != 2 {
		t.Fatalf("game must be hidden: %+v %v", row, err)
	}
}

func TestStoreContract(t *testing.T) {
	catalogtest.StoreContract(t, func(t *testing.T) catalogtest.Env {
		db := pgtest.New(t)
		return catalogtest.Env{Store: catalogpg.NewStore(db.Ent), CreatorID: db.User}
	})
}
