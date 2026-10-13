package downloadhttp_test

import (
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func TestPreviewNameShowsTheCanonicalNameOfAnUpload(t *testing.T) {
	e := setup(t)
	body := map[string]any{
		"language": []string{"zh"}, "translation": "group", "translators": []string{"绿茶汉化组", "熊喵守护协会"}, "patch_version": "v1.1",
		"edition": "download", "form": "portable", "file_name": "upload.part1.rar",
	}
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/download-source/name", As: &creator, Body: body})
	e.server.Expect(resp, http.StatusCreated, 0)
	if string(resp.Data) != `{"before":"ゲーム DL版 [绿茶汉化组×熊喵守护协会][v1.1] (files)","after":".part1.rar","pending":false}` {
		t.Fatalf("preview %s", resp.Data)
	}
	disc := map[string]any{"language": []string{"jp"}, "form": "disc", "file_name": "disc.7z"}
	resp = e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/download-source/name", As: &creator, Body: disc})
	if string(resp.Data) != `{"before":"ゲーム (","after":").7z","pending":true}` {
		t.Fatalf("a disc image waits for its format: %s", resp.Data)
	}
	if resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/404/download-source/name", As: &creator, Body: disc}); resp.Status != http.StatusNotFound {
		t.Fatalf("missing game: %d %s", resp.Status, resp.Body)
	}
	if resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/download-source/name", Body: disc}); resp.Status != http.StatusUnauthorized {
		t.Fatalf("guests cannot preview: %d", resp.Status)
	}
	bad := map[string]any{"language": []string{"jp"}, "form": "floppy", "file_name": "disc.7z"}
	if resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/download-source/name", As: &creator, Body: bad}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("an unknown form: %d %s", resp.Status, resp.Body)
	}
}

func TestReadNameTellsWhatAFileNameSays(t *testing.T) {
	e := setup(t)
	read := func(name string) string {
		resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/download-source/name/read", As: &creator, Body: map[string]any{"file_name": name}})
		e.server.Expect(resp, http.StatusCreated, 0)
		return string(resp.Data)
	}
	if got := read("[250926][ゆずソフト] ライムライト・レモネードジャム 橘光柠水随想曲 [Can/need汉化组×破琵琶生产公社汉化组][v1.1] (files).7z"); got != `{"translation":"group","translators":["Can/need汉化组","破琵琶生产公社汉化组"],"patch_version":"v1.1","edition":null,"edition_name":null,"form":null}` {
		t.Fatalf("a translated edition: %s", got)
	}
	if got := read("[141219][あざらしそふと] アマカノ パッケージ版 初回限定版 (iso+mds+rr3).7z"); got != `{"translation":null,"translators":[],"patch_version":null,"edition":"package","edition_name":"初回限定版","form":"disc"}` {
		t.Fatalf("a disc image: %s", got)
	}
	if got := read("game.zip"); got != `{"translation":null,"translators":[],"patch_version":null,"edition":null,"edition_name":null,"form":null}` {
		t.Fatalf("a name that says nothing: %s", got)
	}
}

func TestResourcesTellWhichFilesCarryTheCanonicalName(t *testing.T) {
	e := setup(t)
	body := map[string]any{"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "files": []map[string]any{{"upload_session_id": 5}, {"upload_session_id": 6}}}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/download-source", As: &creator, Body: body}), http.StatusCreated, 0)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/1", As: &creator})
	e.server.Expect(resp, http.StatusOK, 0)
	for _, want := range []string{`"canonical_name":true,"downloads"`, `"file_name":"s5.7z","original_name":"s5.7z","canonical_name":true`, `"file_name":"s6.7z","original_name":"s6.7z","canonical_name":false`} {
		if !strings.Contains(string(resp.Data), want) {
			t.Fatalf("missing %s in %s", want, resp.Data)
		}
	}
	first, _ := e.repo.ListFiles(t.Context(), 1)
	rename := apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/file/" + strconv.Itoa(first[0].ID), As: &creator, Body: map[string]any{"file_name": "mine.7z"}}
	if resp := e.server.Do(rename); resp.Status != http.StatusConflict || resp.Code != download.ErrFileNameCanonical.Code() {
		t.Fatalf("a canonical name is not renamed by hand: %d %d", resp.Status, resp.Code)
	}
	off := map[string]any{"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "canonical_name": false}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/1", As: &creator, Body: off}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(rename), http.StatusOK, 0)
	created := map[string]any{"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "canonical_name": false, "files": []map[string]any{{"upload_session_id": 7}}}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/download-source", As: &creator, Body: created}), http.StatusCreated, 0)
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/2", As: &creator})
	if !strings.Contains(string(resp.Data), `"canonical_name":false,"downloads"`) {
		t.Fatalf("an upload can keep its own names: %s", resp.Data)
	}
}
