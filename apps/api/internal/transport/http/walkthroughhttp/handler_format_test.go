package walkthroughhttp_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation/moderationtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/walkthroughhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough/walkthroughtest"
)

const taskID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b"

type formatEnv struct {
	server    *apitest.Server
	formatter *walkthroughtest.Formatter
	formats   *walkthrough.FormatService
	settings  settingtest.Source
}

func setupFormat(t *testing.T) formatEnv {
	t.Helper()
	server := apitest.New(t)
	cards := gametest.NewCards(game.Card{ID: 10})
	formatter := &walkthroughtest.Formatter{}
	settings := settingtest.Source{}
	formats := walkthrough.NewFormatService(walkthrough.FormatDeps{
		Games:     cards,
		Cast:      walkthroughtest.Cast{Members: map[int][]walkthrough.CastMember{10: {{ID: 7, Names: []string{"むぎ"}}}}},
		Formatter: formatter,
		Tasks:     walkthroughtest.NewFormatTasks(),
		Quota:     walkthroughtest.NewFormatQuota(),
		Queue:     &moderationtest.Queue{},
		Settings:  settings,
		Now:       func() time.Time { return apitest.Now },
		NewID:     func() string { return taskID },
	})
	repo := walkthroughtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	walkthroughhttp.NewHandler(walkthrough.NewService(repo, cards, &moderationtest.Activities{}, &moderationtest.Queue{}, &txtest.Immediate{}), server.Builder).Register(server.API)
	walkthroughhttp.NewFormatHandler(formats, server.Builder).Register(server.API)
	return formatEnv{server: server, formatter: formatter, formats: formats, settings: settings}
}

func TestFormatter(t *testing.T) {
	e := setupFormat(t)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/format"}), http.StatusUnauthorized, 200101)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/format", As: &author})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"available":true}` {
		t.Fatalf("available: %s", resp.Data)
	}
	e.formatter.Unready = true
	if resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/format", As: &author}); string(resp.Data) != `{"available":false}` {
		t.Fatalf("unavailable: %s", resp.Data)
	}
}

func TestFormatAndResult(t *testing.T) {
	e := setupFormat(t)
	e.formatter.Output = walkthrough.Formatted{
		Note: []string{"Saves before the first one do not matter"},
		Routes: []walkthrough.Route{
			{Key: "r1", Characters: []int{7, 8}, Ending: "Mugi END", Steps: []walkthrough.Step{{Kind: walkthrough.StepChoice, Text: "Maid", Remark: "Mugi"}, {Kind: walkthrough.StepSave, Slot: "01"}}},
			{Key: "r2", Name: "Harem", Requires: []string{"r1"}, Steps: []walkthrough.Step{{Kind: walkthrough.StepLoad, Slot: "01"}}},
		},
	}
	started := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/walkthrough/game/10/format", As: &author, Body: `{"text":"Mugi\nMaid | Mugi\nSave 01\nMugi END"}`})
	e.server.Expect(started, http.StatusCreated, 0)
	if string(started.Data) != `{"id":"`+taskID+`","state":"working","result":null}` {
		t.Fatalf("started: %s", started.Data)
	}
	path := "/walkthrough/format/" + taskID
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &stranger}), http.StatusNotFound, 560109)
	if err := e.formats.Run(t.Context(), taskID); err != nil {
		t.Fatal(err)
	}
	done := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &author})
	e.server.Expect(done, http.StatusOK, 0)
	want := `{"id":"` + taskID + `","state":"done","result":{"note":` + noteJSON + `,"routes":[` +
		`{"key":"r1","name":"","characters":[7],"requires":[],"condition":"","ending":"Mugi END","steps":[{"kind":"choice","text":"Maid","remark":"Mugi","slot":""},{"kind":"save","text":"","remark":"","slot":"01"}]},` +
		`{"key":"r2","name":"Harem","characters":[],"requires":["r1"],"condition":"","ending":"","steps":[{"kind":"load","text":"","remark":"","slot":"01"}]}]}}`
	if string(done.Data) != want {
		t.Fatalf("done\n got %s\nwant %s", done.Data, want)
	}
}

func TestFormatRefusals(t *testing.T) {
	e := setupFormat(t)
	cases := []struct {
		name   string
		as     *actor.Actor
		path   string
		body   string
		status int
		code   int
	}{
		{"unauthenticated", nil, "/walkthrough/game/10/format", `{"text":"x"}`, http.StatusUnauthorized, 200101},
		{"no text", &author, "/walkthrough/game/10/format", `{"text":""}`, http.StatusUnprocessableEntity, 100101},
		{"text beyond a walkthrough", &author, "/walkthrough/game/10/format", `{"text":"` + strings.Repeat("长", walkthrough.MaxTextLength+1) + `"}`, http.StatusUnprocessableEntity, 100101},
		{"missing game", &author, "/walkthrough/game/99/format", `{"text":"x"}`, http.StatusNotFound, 400101},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: c.path, As: c.as, Body: c.body}), c.status, c.code)
		})
	}
	settingtest.Set(e.settings, walkthrough.FormatDailyLimit, 1)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/walkthrough/game/10/format", As: &author, Body: `{"text":"x"}`}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/walkthrough/game/10/format", As: &author, Body: `{"text":"x"}`}), http.StatusTooManyRequests, 560107)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/format/not-a-task", As: &author}), http.StatusUnprocessableEntity, 100101)
}

func TestAFailedTaskIsAFailedRequest(t *testing.T) {
	e := setupFormat(t)
	e.formatter.Err = errors.New("upstream HTTP 502")
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/walkthrough/game/10/format", As: &author, Body: `{"text":"x"}`}), http.StatusCreated, 0)
	if err := e.formats.Run(t.Context(), taskID); err == nil {
		t.Fatal("the run fails")
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/walkthrough/format/" + taskID, As: &author}), http.StatusBadGateway, 560108)
}
