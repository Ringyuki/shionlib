package main

import (
	_ "embed"
	"net/http"
	"slices"
	"strings"
	"time"
)

const (
	e2eUpstreamAddr    = ":8090"
	e2ePatchedGameRef  = "vndb:v900005"
	e2ePatchedWork     = "900005"
	e2ePatchedPage     = "9005"
	e2ePatchedResource = "90051"
	e2eWork            = `{"object":"list","items":[{"object":"work","id":"900005","display_name":"E2E 管理用スクラッチ 5"}],"missing":[]}`
	e2eNoWorks         = `{"object":"list","items":[],"missing":[]}`
	e2eNoPatches       = `{"object":"list","items":[],"next_cursor":null,"total":0}`
	e2eResource        = `{"object":"patch_resource","id":"90051","patch_id":"9005"}`
	e2eUpstreamTimeout = 5 * time.Second
)

//go:embed e2e_upstream.json
var e2ePatchesJSON []byte

func e2eUpstream() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v2/catalog/works", func(w http.ResponseWriter, r *http.Request) {
		body := e2eNoWorks
		if e2eListed(r, "refs", e2ePatchedGameRef) || e2eListed(r, "ids", e2ePatchedWork) {
			body = e2eWork
		}
		e2eWrite(w, []byte(body))
	})
	mux.HandleFunc("GET /v2/moyu/patches", func(w http.ResponseWriter, r *http.Request) {
		body := []byte(e2eNoPatches)
		if e2eListed(r, "refs", "catalog:"+e2ePatchedWork) || e2eListed(r, "ids", e2ePatchedPage) {
			body = e2ePatchesJSON
		}
		e2eWrite(w, body)
	})
	mux.HandleFunc("GET /v2/moyu/resources/{id}", func(w http.ResponseWriter, r *http.Request) {
		if r.PathValue("id") != e2ePatchedResource {
			http.NotFound(w, r)
			return
		}
		e2eWrite(w, []byte(e2eResource))
	})
	return mux
}

func e2eListed(r *http.Request, param, value string) bool {
	return slices.Contains(strings.Split(r.URL.Query().Get(param), ","), value)
}

func e2eWrite(w http.ResponseWriter, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func serveE2EUpstream() error {
	server := &http.Server{Addr: e2eUpstreamAddr, Handler: e2eUpstream(), ReadHeaderTimeout: e2eUpstreamTimeout}
	return server.ListenAndServe()
}
