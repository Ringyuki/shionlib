package nextmoe_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/nextmoe"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func read(t *testing.T, resources ...string) []moyu.Entry {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"items":[{"resources":[` + strings.Join(resources, ",") + `]}]}`))
	}))
	t.Cleanup(server.Close)
	entries, err := nextmoe.NewClient(server.Client(), server.URL, "k").Entries(context.Background(), "v1", nil)
	if err != nil {
		t.Fatal(err)
	}
	return entries
}

var resources int

func resource(fields string) string {
	resources++
	id := "r" + strconv.Itoa(resources)
	return `{"id":"` + id + `","web_url":"https://www.moyu.moe/resource/` + id + `","updated_at":"2026-07-09T08:00:00Z"` + fields + `}`
}

func TestAnEntrySpeaksTheSitesVocabulary(t *testing.T) {
	entries := read(t, resource(`,"name":"\ufeff 人工汉化补丁\u200b","size":"850.344MB","hash":" 9F86D081884C7D65 ","model_name":"ignored","localization_group_name":" Can／need×ポッピンパーティ生産公社 ",`+
		`"type":["manual"],"language":["zh-Hans","zh-Hant","ja","en","other","zh-Hans"],"platform":["windows","android","macos","ios","linux","other"],"download_count":561,`+
		`"publisher":{"object":"user","id":"1","name":" VN视觉小说汉化补丁遗产归档 ","avatar_url":"https://image.example/avatar.avif","web_url":"https://www.moyu.moe/user/1"}`))
	if len(entries) != 1 {
		t.Fatalf("entries: %+v", entries)
	}
	entry := entries[0]
	if entry.Name != "人工汉化补丁" {
		t.Fatalf("a name loses the invisible characters around it: %q", entry.Name)
	}
	if entry.Kind != moyu.KindPatch || entry.Translation == nil || *entry.Translation != moyu.TranslationGroup || entry.Translator != "Can／need×ポッピンパーティ生産公社" || entry.Model != "" {
		t.Fatalf("a translation by people: %+v", entry)
	}
	if !slices.Equal(entry.Languages, []string{"zh", "zh-hant", "jp", "en"}) || !slices.Equal(entry.Platforms, []string{"win", "and", "mac", "ios", "lin"}) {
		t.Fatalf("languages and platforms: %v %v", entry.Languages, entry.Platforms)
	}
	if entry.Size == nil || *entry.Size != 891650310 || entry.Hash != "9f86d081884c7d65" || entry.Downloads != 561 || entry.URL != "https://www.moyu.moe/resource/"+entry.ID {
		t.Fatalf("size, hash, downloads, page: %+v", entry)
	}
	if entry.Publisher == nil || entry.Publisher.Name != "VN视觉小说汉化补丁遗产归档" || entry.Publisher.Avatar != "https://image.example/avatar.avif" {
		t.Fatalf("publisher: %+v", entry.Publisher)
	}
}

func TestKindsAndTranslations(t *testing.T) {
	entries := read(t,
		resource(`,"type":["ai"],"model_name":"gemini2.5pro","localization_group_name":"ignored"`),
		resource(`,"type":["machine_polishing"]`),
		resource(`,"type":["save","manual"],"localization_group_name":"ignored"`),
		resource(`,"type":["crack","fix","mod"]`),
		resource(`,"type":["manual","ai"],"model_name":"ignored"`),
		resource(``),
	)
	if len(entries) != 6 {
		t.Fatalf("entries: %+v", entries)
	}
	machine, polished, save, other, mixed, bare := entries[0], entries[1], entries[2], entries[3], entries[4], entries[5]
	if machine.Translation == nil || *machine.Translation != moyu.TranslationMachine || machine.Model != "gemini2.5pro" || machine.Translator != "" {
		t.Fatalf("a machine translation: %+v", machine)
	}
	if polished.Translation == nil || *polished.Translation != moyu.TranslationMachine || polished.Model != "" {
		t.Fatalf("a polished machine translation: %+v", polished)
	}
	if save.Kind != moyu.KindSave || save.Translation != nil || save.Translator != "" {
		t.Fatalf("saved games are not a translation: %+v", save)
	}
	if other.Kind != moyu.KindPatch || other.Translation != nil {
		t.Fatalf("a patch that translates nothing: %+v", other)
	}
	if mixed.Translation == nil || *mixed.Translation != moyu.TranslationGroup || mixed.Model != "" {
		t.Fatalf("people come before the machine: %+v", mixed)
	}
	if bare.Kind != moyu.KindPatch || bare.Name != "" || bare.Size != nil || bare.Publisher != nil || bare.Languages == nil || bare.Platforms == nil {
		t.Fatalf("an entry that says nothing else: %+v", bare)
	}
}

func TestSizes(t *testing.T) {
	for text, want := range map[string]int64{
		"7.19GB": 7720203715, "0.035 MB": 36700, "3kb": 3072, "1mb": 1048576, "22MiB": 23068672, "512 B": 512, "1.5 TB": 1649267441664,
		"": 0, "123": 0, "large": 0, "0 MB": 0, "-3 MB": 0, "1.2.3 MB": 0, "99999999 TB": 0, "3 MB or so": 0,
	} {
		entries := read(t, resource(`,"size":"`+text+`"`))
		if len(entries) != 1 {
			t.Fatalf("%q: %+v", text, entries)
		}
		got := int64(0)
		if entries[0].Size != nil {
			got = *entries[0].Size
		}
		if got != want {
			t.Fatalf("%q: got %d, want %d", text, got, want)
		}
	}
}

func TestOnlyAddressesThatAreSafeToLinkAreKept(t *testing.T) {
	entries := read(t,
		`{"id":"r1","web_url":"javascript:alert(1)","updated_at":"2026-07-09T08:00:00Z"}`,
		`{"id":"r2","web_url":"/resource/2","updated_at":"2026-07-09T08:00:00Z"}`,
		`{"id":"r3","web_url":"https://www.moyu.moe/resource/3","updated_at":"yesterday"}`,
		`{"id":"","web_url":"https://www.moyu.moe/resource/4","updated_at":"2026-07-09T08:00:00Z"}`,
		`{"id":"r5","web_url":"https://www.moyu.moe/resource/5","updated_at":"2026-07-09T08:00:00Z","download_count":-4,"publisher":{"name":"kotori","avatar_url":"http://image.example/a.png"}}`,
		`{"id":"r6","web_url":"http://www.moyu.moe/resource/6","updated_at":"2026-07-09T08:00:00Z","publisher":{"name":"  ","avatar_url":"https://image.example/a.png"}}`,
	)
	if len(entries) != 2 || entries[0].ID != "r5" || entries[1].ID != "r6" {
		t.Fatalf("entries without a page to open, a time or an id are left out: %+v", entries)
	}
	if entries[0].Downloads != 0 || entries[0].Publisher == nil || entries[0].Publisher.Avatar != "" {
		t.Fatalf("an avatar is only loaded over https: %+v", entries[0])
	}
	if entries[1].URL != "http://www.moyu.moe/resource/6" || entries[1].Publisher != nil {
		t.Fatalf("a publisher needs a name: %+v", entries[1])
	}
}
