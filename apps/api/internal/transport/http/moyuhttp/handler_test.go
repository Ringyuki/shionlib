package moyuhttp_test

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu/moyutest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/moyuhttp"
)

func TestPatches(t *testing.T) {
	server := apitest.New(t)
	size, group := int64(891650310), moyu.TranslationGroup
	patches := &moyutest.Patches{Listed: map[string][]moyu.Entry{
		"v4145": {
			{
				ID: "r1", Kind: moyu.KindPatch, Name: "人工汉化补丁", Size: &size, Hash: "9f86", Languages: []string{"zh", "zh-hant"}, Platforms: []string{"win"},
				Translation: &group, Translator: "绿茶汉化组", Downloads: 561, URL: "https://www.moyu.moe/resource/r1", Updated: time.Date(2026, 7, 9, 8, 0, 0, 0, time.UTC),
				Publisher: &moyu.Publisher{Name: "kotori", Avatar: "https://image.example/a.avif"},
			},
			{ID: "r2", Kind: moyu.KindSave, Languages: []string{}, Platforms: []string{}, URL: "https://www.moyu.moe/resource/r2", Updated: time.Date(2025, 9, 25, 0, 0, 0, 0, time.UTC)},
		},
	}}
	service := moyu.NewService(moyutest.Games{1: moyutest.VNDB("v4145"), 2: moyutest.VNDB("v1")}, patches, moyutest.NewCache())
	moyuhttp.NewHandler(service, server.Builder).Register(server.API)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/1/patches"})
	server.Expect(resp, http.StatusOK, 0)
	want := `[{"id":"r1","kind":"patch","name":"人工汉化补丁","size":891650310,"language":["zh","zh-hant"],"platform":["win"],"translation":"group","translator":"绿茶汉化组","model":null,` +
		`"downloads":561,"url":"https://www.moyu.moe/resource/r1","updated":"2026-07-09T08:00:00.000Z","publisher":{"name":"kotori","avatar":"https://image.example/a.avif"}},` +
		`{"id":"r2","kind":"save","name":"","size":null,"language":[],"platform":[],"translation":null,"translator":null,"model":null,` +
		`"downloads":0,"url":"https://www.moyu.moe/resource/r2","updated":"2025-09-25T00:00:00.000Z","publisher":null}]`
	if string(resp.Data) != want {
		t.Fatalf("entries:\n%s\nwant\n%s", resp.Data, want)
	}
	for _, path := range []string{"/moyu/game/2/patches", "/moyu/game/3/patches"} {
		empty := server.Do(apitest.Request{Method: http.MethodGet, Path: path})
		server.Expect(empty, http.StatusOK, 0)
		if string(empty.Data) != `[]` {
			t.Fatalf("%s: %s", path, empty.Data)
		}
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/0/patches"}), http.StatusUnprocessableEntity, 100101)

	patches.Fail = moyu.ErrRequestFailed.Wrap(errors.New("timeout"))
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/1/patches"}), http.StatusOK, 0)
	failing := moyu.NewService(moyutest.Games{9: moyutest.VNDB("v9")}, patches, moyutest.NewCache())
	other := apitest.New(t)
	moyuhttp.NewHandler(failing, other.Builder).Register(other.API)
	other.Expect(other.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/9/patches"}), http.StatusBadGateway, 610102)
	other.Expect(other.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/9/patches"}), http.StatusOK, 0)
}
