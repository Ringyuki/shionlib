package searchpg_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/catalogpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/searchpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

func TestDocumentsMirrorTheLocalCatalog(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	release := time.Date(2020, 4, 24, 0, 0, 0, 0, time.UTC)
	actor := "有栖川みや美"
	zh := "御樱禀"
	record := catalog.GameRecord{
		ExternalID:  "77",
		TitleJP:     "サクラノ詩",
		TitleZH:     "樱之诗",
		IntroJP:     "あらすじ",
		Aliases:     []string{"sakuuta"},
		ReleaseDate: &release,
		Platforms:   []string{"win"},
		NSFW:        true,
		Staffs:      []catalog.Staff{{Name: "すかぢ", Role: "剧本"}},
		Covers:      []catalog.CoverRecord{{Language: "jp", Type: "pkgfront", URL: "a.webp", SourceKey: "0"}, {Language: "jp", Type: "dig", URL: "b.webp", Sexual: 2, SourceKey: "1"}},
		Tags:        []string{"纯爱"},
		Developers:  []catalog.DeveloperLink{{ExternalID: "5", Name: "枕", Aliases: []string{"Makura"}, Role: "开发"}},
		Characters:  []catalog.CharacterLink{{ExternalID: "9", NameJP: "御桜稟", NameZH: &zh, Role: "main", Actor: &actor}},
	}
	id, _, err := catalogpg.NewStore(db.Ent).ApplyGame(ctx, catalog.SourceHikarinagi, record, db.User(t), release)
	if err != nil {
		t.Fatal(err)
	}
	other := db.Game(t)
	source := searchpg.NewDocuments(db.Ent)
	ids, err := source.DocumentIDs(ctx, 0, 10)
	if err != nil || !slices.Equal(ids, []int{min(id, other), max(id, other)}) {
		t.Fatalf("ids %v %v", ids, err)
	}
	if after, err := source.DocumentIDs(ctx, max(id, other), 10); err != nil || len(after) != 0 {
		t.Fatalf("after %v %v", after, err)
	}
	docs, err := source.Documents(ctx, []int{id, 999999})
	if err != nil || len(docs) != 1 {
		t.Fatalf("docs %+v %v", docs, err)
	}
	doc := docs[0]
	if doc.ID != id || doc.TitleJP != "サクラノ詩" || doc.TitleZH != "樱之诗" || doc.IntroJP != "あらすじ" || !doc.NSFW || doc.MaxCoverSexual != 2 || !doc.ReleaseDate.Equal(release) {
		t.Fatalf("scalars %+v", doc)
	}
	if !slices.Equal(doc.Aliases, []string{"sakuuta"}) || !slices.Equal(doc.Platform, []string{"win"}) || !slices.Equal(doc.Tags, []string{"纯爱"}) {
		t.Fatalf("lists %+v", doc)
	}
	if len(doc.Developers) != 1 || doc.Developers[0].Name != "枕" || *doc.Developers[0].Role != "开发" || !slices.Equal(doc.Developers[0].Aliases, []string{"Makura"}) {
		t.Fatalf("developers %+v", doc.Developers)
	}
	if !slices.Equal(doc.CharacterNamesJP, []string{"御桜稟"}) || !slices.Equal(doc.CharacterNamesZH, []string{"御樱禀"}) || len(doc.CharacterNamesEN) != 0 || !slices.Equal(doc.CharacterActors, []string{actor}) {
		t.Fatalf("characters %+v", doc)
	}
	if len(doc.Staffs) != 1 || doc.Staffs[0].Name != "すかぢ" || doc.Staffs[0].Role != "剧本" {
		t.Fatalf("staffs %+v", doc.Staffs)
	}
}
