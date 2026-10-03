package catalog_test

import (
	"slices"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

func TestToGameRecordLocalizesByOriginLanguage(t *testing.T) {
	cases := []struct {
		lang                   string
		wantJP, wantZH, wantEN string
	}{
		{lang: "ja", wantJP: "原題", wantZH: "译名", wantEN: "English"},
		{lang: "", wantJP: "原題", wantZH: "译名", wantEN: "English"},
		{lang: "zh-Hans", wantJP: "", wantZH: "译名", wantEN: "English"},
		{lang: "en", wantJP: "", wantZH: "译名", wantEN: "English"},
	}
	for _, tc := range cases {
		record := catalog.ToGameRecord(catalog.SourceHikarinagi, catalog.GameSnapshot{
			ExternalID: "1",
			Title:      catalog.Localized{Origin: "原題", OriginLang: tc.lang, Translated: new("译名"), English: new("English")},
		})
		if record.TitleJP != tc.wantJP || record.TitleZH != tc.wantZH || record.TitleEN != tc.wantEN {
			t.Fatalf("lang %q: got %q/%q/%q", tc.lang, record.TitleJP, record.TitleZH, record.TitleEN)
		}
	}
	zhOrigin := catalog.ToGameRecord(catalog.SourceHikarinagi, catalog.GameSnapshot{Title: catalog.Localized{Origin: "中文原名", OriginLang: "zh-Hant"}})
	if zhOrigin.TitleZH != "中文原名" || zhOrigin.TitleJP != "" {
		t.Fatalf("chinese origin falls back to the origin title: %+v", zhOrigin)
	}
}

func TestToGameRecordMapsCreditsMediaAndIdentifiers(t *testing.T) {
	snapshot := catalog.GameSnapshot{
		ExternalID: "77",
		Title:      catalog.Localized{Origin: strings.Repeat("長", 300)},
		Aliases:    []string{"a", "a", " ", "b"},
		Covers: []catalog.Cover{
			{Media: catalog.Media{URL: "low.webp"}, Votes: 1, Language: "zh-Hans", Kind: "DIG"},
			{Media: catalog.Media{URL: "high.webp", Width: new(800), Height: new(1200), Sexual: 1}, Votes: 9, Language: "ja", Kind: "PKGFRONT"},
			{Media: catalog.Media{URL: "odd.webp", Width: new(10)}, Votes: 5, Language: "ko"},
		},
		Developers: []catalog.DeveloperCredit{
			{ExternalID: "5", Name: "枕", Role: "DEVELOPER", Logo: &catalog.Media{URL: "logo.webp"}},
			{ExternalID: "6", Name: "发行", Role: "PUBLISHER"},
			{ExternalID: "7", Name: "无角色"},
		},
		Characters: []catalog.CharacterCredit{
			{ExternalID: "9", Name: "稟", Role: "SUPPORTING", Actors: []string{"甲", "乙"}},
			{ExternalID: "10", Name: "客", Role: "GUEST"},
			{ExternalID: "11", Name: "謎", Role: "UNKNOWN"},
		},
		Relations: []catalog.Relation{{ExternalID: "2", Type: "sequel"}, {ExternalID: "3", Type: "FAN_DISC"}},
		External:  catalog.ExternalIDs{VNDB: new("4242"), Bangumi: new(" 1234 ")},
	}
	record := catalog.ToGameRecord(catalog.SourceHikarinagi, snapshot)
	if record.HikarinagiID == nil || *record.HikarinagiID != 77 || *record.VID != "v4242" || *record.BID != "1234" {
		t.Fatalf("identifiers %+v %+v %+v", record.HikarinagiID, record.VID, record.BID)
	}
	if len([]rune(record.TitleJP)) != 255 {
		t.Fatalf("title must be truncated to 255 runes, got %d", len([]rune(record.TitleJP)))
	}
	if !slices.Equal(record.Aliases, []string{"a", "b"}) {
		t.Fatalf("aliases %q", record.Aliases)
	}
	urls := []string{record.Covers[0].URL, record.Covers[1].URL, record.Covers[2].URL}
	if !slices.Equal(urls, []string{"high.webp", "odd.webp", "low.webp"}) {
		t.Fatalf("covers must be ordered by votes: %v", urls)
	}
	first := record.Covers[0]
	if first.Language != "jp" || first.Type != "pkgfront" || !slices.Equal(first.Dims, []int{800, 1200}) || first.Sexual != 1 || first.SourceKey != "0" {
		t.Fatalf("first cover %+v", first)
	}
	if record.Covers[1].Language != "unknown" || len(record.Covers[1].Dims) != 0 || record.Covers[2].Language != "zh" || record.Covers[2].Type != "dig" {
		t.Fatalf("cover mapping %+v", record.Covers)
	}
	if len(record.Developers) != 2 || record.Developers[0].Role != "开发" || *record.Developers[0].Logo != "logo.webp" || record.Developers[1].ExternalID != "7" || record.Developers[1].Role != "开发" {
		t.Fatalf("only developer credits are kept: %+v", record.Developers)
	}
	if *record.Developers[0].HikarinagiID != 5 {
		t.Fatalf("developer hikarinagi id %+v", record.Developers[0])
	}
	roles := []string{record.Characters[0].Role, record.Characters[1].Role, record.Characters[2].Role}
	if !slices.Equal(roles, []string{"side", "appears", "side"}) || *record.Characters[0].Actor != "甲, 乙" || record.Characters[1].Actor != nil {
		t.Fatalf("characters %+v", record.Characters)
	}
	if len(record.Relations) != 1 || record.Relations[0].Type != "SEQUEL" {
		t.Fatalf("relations %+v", record.Relations)
	}
}

func TestToGameRecordOnlyDerivesHikarinagiIDsForHikarinagi(t *testing.T) {
	record := catalog.ToGameRecord("vndb", catalog.GameSnapshot{ExternalID: "77", Developers: []catalog.DeveloperCredit{{ExternalID: "5", Role: "DEVELOPER"}}})
	if record.HikarinagiID != nil || record.Developers[0].HikarinagiID != nil {
		t.Fatalf("foreign ids must not be read as hikarinagi ids: %+v", record)
	}
	invalid := catalog.ToGameRecord(catalog.SourceHikarinagi, catalog.GameSnapshot{ExternalID: "abc", External: catalog.ExternalIDs{VNDB: new("r12")}})
	if invalid.HikarinagiID != nil || invalid.VID != nil {
		t.Fatalf("invalid ids %+v", invalid)
	}
}

func TestToCharacterRecordNormalizesAttributes(t *testing.T) {
	record := catalog.ToCharacterRecord(catalog.SourceHikarinagi, catalog.CharacterSnapshot{
		ExternalID: "9",
		Name:       catalog.Localized{Origin: "御桜稟", Translated: new("御樱禀"), English: new("Rin")},
		Intro:      catalog.Localized{Origin: "紹介", Translated: new("介绍")},
		Gender:     []string{"女", "不明", "???"},
		BloodType:  new("ＡＢ型"),
		Birthday:   []int{4, 1},
	})
	if record.NameJP != "御桜稟" || *record.NameZH != "御樱禀" || *record.NameEN != "Rin" || record.IntroJP != "紹介" || record.IntroZH != "介绍" {
		t.Fatalf("names %+v", record)
	}
	if !slices.Equal(record.Gender, []string{"f", "o"}) || record.BloodType == nil || *record.BloodType != "ab" || !slices.Equal(record.Birthday, []int{4, 1}) {
		t.Fatalf("attributes %+v", record)
	}
	invalid := catalog.ToCharacterRecord(catalog.SourceHikarinagi, catalog.CharacterSnapshot{BloodType: new("X"), Birthday: []int{13, 40}})
	if invalid.BloodType != nil || len(invalid.Birthday) != 0 {
		t.Fatalf("invalid attributes must be dropped: %+v", invalid)
	}
}

func TestToDeveloperRecord(t *testing.T) {
	record := catalog.ToDeveloperRecord(catalog.SourceHikarinagi, catalog.DeveloperSnapshot{
		ExternalID: "5",
		Name:       "枕",
		Intro:      catalog.Localized{Origin: "紹介", OriginLang: "ja", Translated: new("介绍")},
		Website:    new("  "),
		Logo:       &catalog.Media{URL: "logo.webp"},
		Extra:      []catalog.KeyValue{{Key: "country", Value: "JP"}},
		External:   catalog.ExternalIDs{VNDB: new("p100")},
	})
	if *record.HikarinagiID != 5 || record.Name != "枕" || record.IntroJP != "紹介" || record.IntroZH != "介绍" || record.Website != nil || *record.Logo != "logo.webp" || *record.VID != "p100" || len(record.Extra) != 1 {
		t.Fatalf("developer record %+v", record)
	}
}
