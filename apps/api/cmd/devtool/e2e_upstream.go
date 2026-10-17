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
	e2ePatchedWorkRef  = "catalog:900005"
	e2ePatchedWork     = `{"object":"list","items":[{"object":"work","id":"900005"}],"missing":[]}`
	e2eNoWorks         = `{"object":"list","items":[],"missing":[]}`
	e2eNoPatches       = `{"object":"list","items":[],"next_cursor":null,"total":0}`
	e2eUpstreamTimeout = 5 * time.Second
)

//go:embed e2e_upstream.json
var e2ePatchesJSON []byte

func e2eUpstream() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v2/catalog/works", func(w http.ResponseWriter, r *http.Request) {
		body := []byte(e2eNoWorks)
		if slices.Contains(strings.Split(r.URL.Query().Get("refs"), ","), e2ePatchedGameRef) {
			body = []byte(e2ePatchedWork)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	})
	mux.HandleFunc("GET /v2/moyu/patches", func(w http.ResponseWriter, r *http.Request) {
		body := []byte(e2eNoPatches)
		if slices.Contains(strings.Split(r.URL.Query().Get("refs"), ","), e2ePatchedWorkRef) {
			body = e2ePatchesJSON
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	})
	return mux
}

func serveE2EUpstream() error {
	server := &http.Server{Addr: e2eUpstreamAddr, Handler: e2eUpstream(), ReadHeaderTimeout: e2eUpstreamTimeout}
	return server.ListenAndServe()
}
