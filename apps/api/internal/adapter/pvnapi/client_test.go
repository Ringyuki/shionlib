package pvnapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/pvnapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

type call struct {
	method      string
	uri         string
	auth        string
	contentType string
	body        string
}

type fakePVN struct {
	mu     sync.Mutex
	calls  []call
	routes map[string]func(w http.ResponseWriter)
	server *httptest.Server
}

func newFake(t *testing.T) (*fakePVN, *pvnapi.Client) {
	t.Helper()
	fake := &fakePVN{routes: map[string]func(w http.ResponseWriter){}}
	fake.server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		fake.mu.Lock()
		fake.calls = append(fake.calls, call{method: r.Method, uri: r.URL.RequestURI(), auth: r.Header.Get("Authorization"), contentType: r.Header.Get("Content-Type"), body: string(raw)})
		handler, ok := fake.routes[r.Method+" "+r.URL.Path]
		fake.mu.Unlock()
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		handler(w)
	}))
	t.Cleanup(fake.server.Close)
	return fake, pvnapi.NewClient(fake.server.Client(), fake.server.URL+"/")
}

func (f *fakePVN) on(route string, status int, body string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.routes[route] = func(w http.ResponseWriter) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}
}

func (f *fakePVN) last() call {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[len(f.calls)-1]
}

func TestLogin(t *testing.T) {
	fake, client := newFake(t)
	fake.on("POST /user/session", http.StatusOK, `{"user":{"id":7,"userName":"Alice"},"token":"tok","expire":1767225600}`)
	session, err := client.Login(context.Background(), "alice", "pw")
	if err != nil {
		t.Fatal(err)
	}
	if session.UserID != 7 || session.UserName != "Alice" || session.Token != "tok" || !session.Expires.Equal(time.Unix(1767225600, 0)) {
		t.Fatalf("unexpected session %+v", session)
	}
	sent := fake.last()
	if sent.auth != "" || sent.body != `{"password":"pw","userName":"alice"}` {
		t.Fatalf("login is unauthenticated with the credentials as JSON: %+v", sent)
	}
	fake.on("POST /user/session", http.StatusBadRequest, `{"message":"bad"}`)
	if _, err := client.Login(context.Background(), "alice", "pw"); !errors.Is(err, potatovn.ErrBindingAuthFailed) {
		t.Fatalf("rejected credentials: %v", err)
	}
	fake.on("POST /user/session", http.StatusBadGateway, ``)
	if _, err := client.Login(context.Background(), "alice", "pw"); !errors.Is(err, potatovn.ErrRequestFailed) {
		t.Fatalf("upstream outage: %v", err)
	}
}

func TestLibraryAndRefresh(t *testing.T) {
	fake, client := newFake(t)
	fake.on("GET /galgame", http.StatusOK, `{"cnt":2,"pageCnt":3,"pageIndex":1,"pageSize":50,"items":[
		{"id":42,"bgmId":"100","vndbId":17,"totalPlayTime":60,"playTime":[{"dateTimeStamp":1700000000,"minute":30}],"playType":2,"myRate":9},
		{"id":43,"bgmId":null,"vndbId":null,"totalPlayTime":0,"playTime":[],"playType":0,"myRate":0}]}`)
	page, err := client.Library(context.Background(), "tok", 1, 50)
	if err != nil {
		t.Fatal(err)
	}
	if sent := fake.last(); sent.uri != "/galgame?pageIndex=1&pageSize=50&timestamp=0" || sent.auth != "Bearer tok" {
		t.Fatalf("unexpected library request %+v", sent)
	}
	first := page.Items[0]
	if page.PageCount != 3 || len(page.Items) != 2 || first.ID != 42 || *first.BangumiID != "100" || *first.VNDBID != "17" || first.Sessions[0].Minutes != 30 || !first.Sessions[0].At.Equal(time.Unix(1700000000, 0)) {
		t.Fatalf("unexpected page %+v", page)
	}
	if page.Items[1].BangumiID != nil || page.Items[1].VNDBID != nil {
		t.Fatalf("null ids stay nil: %+v", page.Items[1])
	}
	fake.on("GET /user/session/refresh", http.StatusUnauthorized, ``)
	if _, err := client.Refresh(context.Background(), "tok"); !errors.Is(err, potatovn.ErrBindingAuthFailed) {
		t.Fatalf("expired token: %v", err)
	}
}

func TestSaveAndRemoveGalgame(t *testing.T) {
	fake, client := newFake(t)
	fake.on("PATCH /galgame", http.StatusOK, `{"id":99,"totalPlayTime":0,"playTime":[],"playType":0,"myRate":0}`)
	vndb, loc := "v1", "shionlib/game/1/x.webp"
	stamp := 1585742400.5
	saved, err := client.SaveGalgame(context.Background(), "tok", potatovn.GalgameDraft{VNDBID: &vndb, Name: "n", CnName: "c", Description: "d", ReleaseTimestamp: &stamp, ImageLoc: &loc})
	if err != nil || saved.ID != 99 {
		t.Fatalf("save: %+v %v", saved, err)
	}
	var body map[string]any
	_ = json.Unmarshal([]byte(fake.last().body), &body)
	if body["bgmId"] != nil || body["vndbId"] != "v1" || body["releaseDateTimeStamp"] != stamp || body["imageLoc"] != loc || body["playType"] != float64(0) {
		t.Fatalf("unexpected payload %s", fake.last().body)
	}
	if _, present := body["bgmId"]; !present {
		t.Fatal("missing ids are sent as null")
	}

	fake.on("DELETE /galgame/99", http.StatusOK, ``)
	if err := client.RemoveGalgame(context.Background(), "tok", 99); err != nil {
		t.Fatal(err)
	}
	if err := client.RemoveGalgame(context.Background(), "tok", 100); !errors.Is(err, potatovn.ErrRemoteGalgameMissing) {
		t.Fatalf("already removed: %v", err)
	}
	fake.on("DELETE /galgame/101", http.StatusInternalServerError, ``)
	if err := client.RemoveGalgame(context.Background(), "tok", 101); !errors.Is(err, potatovn.ErrRequestFailed) {
		t.Fatalf("upstream failure: %v", err)
	}
}

func TestCoverUpload(t *testing.T) {
	fake, client := newFake(t)
	uploadURL := fake.server.URL + "/upload/slot"
	fake.on("GET /oss/put", http.StatusOK, `"`+uploadURL+`"`)
	fake.on("PUT /upload/slot", http.StatusOK, ``)
	fake.on("PUT /oss/update", http.StatusOK, ``)

	got, err := client.ReserveImage(context.Background(), "tok", "shionlib/game/1/x.webp", 3)
	if err != nil || got != uploadURL {
		t.Fatalf("reserve: %q %v", got, err)
	}
	if sent := fake.last(); sent.uri != "/oss/put?objectFullName=shionlib%2Fgame%2F1%2Fx.webp&requireSpace=3" {
		t.Fatalf("unexpected reserve request %+v", sent)
	}
	if err := client.UploadImage(context.Background(), got, potatovn.Cover{Data: []byte("img"), ContentType: "image/webp"}); err != nil {
		t.Fatal(err)
	}
	if sent := fake.last(); sent.auth != "" || sent.contentType != "image/webp" || sent.body != "img" {
		t.Fatalf("uploads carry only the content type: %+v", sent)
	}
	if err := client.CommitImage(context.Background(), "tok", "shionlib/game/1/x.webp"); err != nil {
		t.Fatal(err)
	}
	if sent := fake.last(); sent.method != http.MethodPut || sent.uri != "/oss/update?objectFullName=shionlib%2Fgame%2F1%2Fx.webp" || sent.auth != "Bearer tok" {
		t.Fatalf("unexpected commit %+v", sent)
	}

	fake.on("GET /oss/put", http.StatusOK, `http://169.254.169.254/latest`)
	if _, err := client.ReserveImage(context.Background(), "tok", "x", 1); !errors.Is(err, potatovn.ErrRequestFailed) {
		t.Fatalf("non-https upload targets are refused: %v", err)
	}
	if err := client.UploadImage(context.Background(), "http://127.0.0.1/x", potatovn.Cover{Data: []byte("a")}); !errors.Is(err, potatovn.ErrRequestFailed) {
		t.Fatalf("non-https upload targets are refused: %v", err)
	}
}
