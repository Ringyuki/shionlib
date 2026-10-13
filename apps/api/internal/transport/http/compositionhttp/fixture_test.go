package compositionhttp_test

import (
	"context"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/compositionhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	gameID      = 10
	baseID      = 31
	discID      = 32
	inspected   = 71
	patchUpload = 41
	saveUpload  = 42
	nextUpload  = 43
	composedID  = 5010
	baseKey     = "games/10/310/base.7z"
	baseName    = "[250926][ゆずソフト] ライムライト DL版 (files).7z"
	patchName   = "汉化补丁_v1.1.zip"
	nextPatch   = "汉化补丁_v1.2.zip"
	saveName    = "savedata.zip"
	wrapper     = "ライムライト"
)

var (
	uploader = actor.Actor{UserID: 1, Role: actor.RoleUser}
	stranger = actor.Actor{UserID: 2, Role: actor.RoleUser}
	details  = map[string]any{"language": []string{"zh"}, "translation": "group", "translators": []string{"绿茶汉化组"}, "patch_version": "v1.1", "keep_patch": true}
)

type env struct {
	server    *apitest.Server
	bases     *compositiontest.Bases
	resources *compositiontest.Resources
	examiner  *compositiontest.Examiner
	events    *compositiontest.Recorder
	reads     *composition.ReadService
	runs      *composition.RunService
}

func ptr[T any](value T) *T {
	return &value
}

func at(id int) string {
	return "/composition/" + strconv.Itoa(id)
}

func stored(id int, name string, size int64, key string, read *int) download.GameFile {
	return download.GameFile{File: download.File{ID: id, Name: name, Size: size, Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckOK, StorageKey: &key, InspectionID: read}}
}

func original(id int, form download.Form, file download.GameFile) download.GameResource {
	published := apitest.Now.Add(-48 * time.Hour)
	return download.GameResource{
		Resource: download.Resource{ID: id, GameID: gameID, Status: download.ResourceActive, Platforms: []string{"win"}, Languages: []string{"jp"}, Info: download.Info{Form: &form}, CreatorID: 9, Downloads: 12, PublishedAt: &published},
		Creator:  user.Summary{ID: 9, Name: "kotori"},
		Files:    []download.GameFile{file},
	}
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	now := func() time.Time { return apitest.Now }
	stage := compositiontest.NewStage()
	patchFiles := []composition.Node{
		{Path: "汉化补丁 v1.1/LimelightLemonadeJam_chs.exe", Size: 942},
		{Path: "汉化补丁 v1.1/patch.xp3", Size: 146},
	}
	baseFiles := []inspection.FilePath{
		{Path: wrapper + "/LimelightLemonadeJam.exe", Size: 900},
		{Path: wrapper + "/patch.xp3", Size: 121},
		{Path: wrapper + "/data.xp3", Size: 5000},
	}
	e := env{
		server: server,
		bases: &compositiontest.Bases{Resources: map[int]download.GameResource{
			baseID: original(baseID, download.FormPortable, stored(310, baseName, 6500, baseKey, ptr(inspected))),
			discID: original(discID, download.FormDisc, stored(320, "disc.iso", 9000, "games/10/320/disc.iso", nil)),
		}},
		resources: &compositiontest.Resources{Files: map[int]download.GameResource{}},
		examiner: &compositiontest.Examiner{Findings: map[string]scan.LocalFinding{
			patchName: {Status: download.CheckOK, Format: "zip", Container: true, SHA256: "patch-sha", Unpacked: 1088, Files: []scan.LocalEntry{{Path: patchFiles[0].Path, Size: 942}, {Path: patchFiles[1].Path, Size: 146}}},
			nextPatch: {Status: download.CheckOK, Format: "zip", Container: true, SHA256: "next-sha", Unpacked: 150, Files: []scan.LocalEntry{{Path: "patch.xp3", Size: 150}}},
			saveName:  {Status: download.CheckOK, Format: "zip", Container: true, SHA256: "save-sha", Unpacked: 32, Files: []scan.LocalEntry{{Path: "savedata/data0.sav", Size: 32}}},
		}},
		events: &compositiontest.Recorder{},
	}
	sessions := map[int]upload.Session{}
	for id, name := range map[int]string{patchUpload: patchName, saveUpload: saveName, nextUpload: nextPatch} {
		sessions[id] = upload.Session{ID: id, FileName: name, TotalSize: 850, Status: upload.StatusCompleted, CreatorID: uploader.UserID}
	}
	patches := &compositiontest.Patches{ByDigest: map[string]moyu.Entry{
		"patch-sha": {ID: "r1", Kind: moyu.KindPatch, Name: "汉化补丁 v1.1", Hash: "patch-sha", Translator: "绿茶汉化组", URL: "https://www.moyu.moe/resource/r1"},
	}}
	baseNodes := make([]composition.Node, len(baseFiles))
	for i, file := range baseFiles {
		baseNodes[i] = composition.Node{Path: file.Path, Size: file.Size}
	}
	deps := composition.Deps{
		Repo:  compositiontest.NewMemoryRepository(now),
		Bases: e.bases,
		Listings: &compositiontest.Listings{
			Inspections: map[int]inspection.Inspection{inspected: {ID: inspected, Status: inspection.StatusReady, Totals: inspection.Totals{Files: 3, Size: 6021}}},
			Paths:       map[int][]inspection.FilePath{inspected: baseFiles},
		},
		Uploads:   &compositiontest.Uploads{Stage: stage, Sessions: sessions},
		Quota:     &compositiontest.Quota{Allowances: map[int]upload.Allowance{uploader.UserID: {InFlightLimit: 1 << 40}}},
		Spool:     &compositiontest.Spool{Room: 1 << 40},
		Examiner:  e.examiner,
		Resources: e.resources,
		Names:     compositiontest.Names{},
		Games:     gametest.NewCards(game.Card{ID: gameID, TitleJP: "ライムライト・レモネードジャム"}),
		Patches:   patches,
		Objects:   &compositiontest.Objects{Stage: stage, Sizes: map[string]int64{baseKey: 6500}, Missing: map[string]bool{}},
		Archiver: &compositiontest.Archiver{Stage: stage, Unreadable: map[string]bool{}, Contents: map[string][]composition.Node{
			baseName:  baseNodes,
			patchName: patchFiles,
			nextPatch: {{Path: "patch.xp3", Size: 150}},
			saveName:  {{Path: "savedata/data0.sav", Size: 32}},
		}},
		Stage:    stage,
		Messages: e.events,
		Queue:    e.events,
		Tx:       &txtest.Immediate{},
		Settings: settingtest.Source{},
		Now:      now,
	}
	service := composition.NewService(deps)
	notices := composition.NewNoticeService(e.events)
	e.reads = composition.NewReadService(service, e.examiner, patches, notices)
	e.runs = composition.NewRunService(deps, notices)
	compositionhttp.NewHandler(service, server.Builder).Register(server.API)
	return e
}

type shown struct {
	ID         int    `json:"id"`
	ResourceID *int   `json:"resource_id"`
	Rebuild    bool   `json:"rebuild"`
	State      string `json:"state"`
	Patch      *struct {
		Name    string  `json:"name"`
		State   string  `json:"state"`
		Refusal *string `json:"refusal"`
	} `json:"patch"`
	Save *struct {
		State string `json:"state"`
	} `json:"save"`
	KeepPatch bool `json:"keep_patch"`
	Plan      *struct {
		GameDir  string `json:"game_dir"`
		PatchDir string `json:"patch_dir"`
	} `json:"plan"`
	FileName string  `json:"file_name"`
	Ahead    int     `json:"ahead"`
	Failure  *string `json:"failure"`
}

func (e env) call(t *testing.T, method, path string, body any) shown {
	t.Helper()
	resp := e.server.Do(apitest.Request{Method: method, Path: path, Body: body, As: &uploader})
	status := http.StatusOK
	if method == http.MethodPost {
		status = http.StatusCreated
	}
	e.server.Expect(resp, status, 0)
	var out shown
	resp.Decode(t, &out)
	return out
}

func (e env) read(t *testing.T, id int, role composition.Role) {
	t.Helper()
	if err := e.reads.Read(context.Background(), composition.Read{CompositionID: id, Role: role}); err != nil {
		t.Fatal(err)
	}
}

func (e env) described(t *testing.T) shown {
	t.Helper()
	draft := e.call(t, http.MethodPost, "/game/10/composition", map[string]any{"base_resource_id": baseID})
	path := at(draft.ID)
	e.call(t, http.MethodPut, path+"/patch", map[string]any{"upload_session_id": patchUpload, "file_name": patchName})
	e.read(t, draft.ID, composition.RolePatch)
	return e.call(t, http.MethodPatch, path, details)
}

func (e env) composed(t *testing.T) shown {
	t.Helper()
	started := e.call(t, http.MethodPost, at(e.described(t).ID)+"/start", nil)
	if err := e.runs.Run(context.Background(), started.ID); err != nil {
		t.Fatal(err)
	}
	done := e.call(t, http.MethodGet, at(started.ID), nil)
	published := apitest.Now
	e.resources.Files[*done.ResourceID] = download.GameResource{
		Resource: download.Resource{ID: *done.ResourceID, GameID: gameID, Status: download.ResourceActive, CreatorID: uploader.UserID, PublishedAt: &published},
		Files:    []download.GameFile{stored(composedID, done.FileName, 7000, "games/10/composed.7z", ptr(901))},
	}
	return done
}
