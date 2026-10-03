package moyuhttp_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu/moyutest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/moyuhttp"
)

func TestPatches(t *testing.T) {
	server := apitest.New(t)
	patches := &moyutest.Patches{Lookups: map[string]moyu.Lookup{
		"v4145": {Found: true, Resources: []moyu.Resource{json.RawMessage(`{"object":"patch_resource","id":"r1","type":["manual"]}`)}},
		"v1":    {Found: true, Resources: []moyu.Resource{}},
	}}
	service := moyu.NewService(moyutest.Games{1: "v4145", 2: "v1", 3: "v2"}, patches, moyutest.NewCache())
	moyuhttp.NewHandler(service, server.Builder).Register(server.API)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/1/patches"})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"object":"patch_resource","id":"r1","type":["manual"]}]` {
		t.Fatalf("resources are forwarded verbatim: %s", resp.Data)
	}
	empty := server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/2/patches"})
	server.Expect(empty, http.StatusOK, 0)
	if string(empty.Data) != `[]` {
		t.Fatalf("empty patch page: %s", empty.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/3/patches"}), http.StatusNotFound, 610101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/0/patches"}), http.StatusUnprocessableEntity, 100101)

	patches.Fail = moyu.ErrRequestFailed.Wrap(errors.New("timeout"))
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/1/patches"}), http.StatusOK, 0)
	failing := moyu.NewService(moyutest.Games{9: "v9"}, patches, moyutest.NewCache())
	other := apitest.New(t)
	moyuhttp.NewHandler(failing, other.Builder).Register(other.API)
	other.Expect(other.Do(apitest.Request{Method: http.MethodGet, Path: "/moyu/game/9/patches"}), http.StatusBadGateway, 610102)
}
