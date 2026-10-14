package indexinghttp_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/indexinghttp"
)

func TestKeyIsPublic(t *testing.T) {
	server := apitest.New(t)
	service := indexing.NewService(nil, nil, nil, settingtest.Source{}, indexing.Options{SiteURL: "https://shionlib.com", Key: "0123456789abcdef0123456789abcdef"}, time.Now)
	indexinghttp.NewHandler(service, server.Builder).Register(server.API)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/indexing/key"})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"key":"0123456789abcdef0123456789abcdef"}` {
		t.Fatalf("unexpected key %s", resp.Data)
	}
}
