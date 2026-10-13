package compositionhttp_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func TestBasesSayWhichResourcesAPatchGoesOnto(t *testing.T) {
	e := setup(t)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/10/composition/bases"}), http.StatusUnauthorized, 200101)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/10/composition/bases", As: &uploader})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `[{"resource_id":31,"name":"[250926][ゆずソフト] ライムライト DL版 (files).7z","size":6500,"language":["jp"],"edition":null,"edition_name":null,"form":"portable",` +
		`"creator":{"id":9,"name":"kotori","avatar":null,"is_sponsor":false},"downloads":12,"reason":null},` +
		`{"resource_id":32,"name":"disc.iso","size":9000,"language":["jp"],"edition":null,"edition_name":null,"form":"disc",` +
		`"creator":{"id":9,"name":"kotori","avatar":null,"is_sponsor":false},"downloads":12,"reason":"disc"}]`
	if string(resp.Data) != want {
		t.Fatalf("bases:\n%s\nwant\n%s", resp.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/0/composition/bases", As: &uploader}), http.StatusUnprocessableEntity, 100101)
}

func TestADraftShowsItsPlanOnceThePatchIsRead(t *testing.T) {
	e := setup(t)
	draft := e.call(t, http.MethodPost, "/game/10/composition", map[string]any{"base_resource_id": baseID})
	if draft.State != "draft" || draft.Patch != nil || draft.Plan != nil || !draft.KeepPatch || draft.ResourceID != nil {
		t.Fatalf("a new draft: %+v", draft)
	}
	attached := e.call(t, http.MethodPut, at(draft.ID)+"/patch", map[string]any{"upload_session_id": patchUpload, "file_name": patchName})
	if attached.Patch == nil || attached.Patch.State != "reading" || attached.Plan != nil {
		t.Fatalf("a patch that is being read: %+v", attached)
	}
	e.read(t, draft.ID, composition.RolePatch)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: at(draft.ID), As: &uploader})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"id":1,"game_id":10,"resource_id":null,"rebuild":false,"state":"draft",` +
		`"base":{"resource_id":31,"name":"[250926][ゆずソフト] ライムライト DL版 (files).7z","size":6500},` +
		`"patch":{"name":"汉化补丁_v1.1.zip","size":850,"state":"ready","refusal":null,"viruses":[],"files":2,"unpacked":1088},"save":null,` +
		`"details":{"language":[],"translation":null,"translators":[],"patch_version":null,"release_url":null},"keep_patch":true,"note":null,` +
		`"match":{"translators":["绿茶汉化组"],"version":null,"url":"https://www.moyu.moe/resource/r1"},` +
		`"plan":{"game_dir":"ライムライト","patch_dir":"汉化补丁 v1.1","game_dirs":[{"path":"","items":1},{"path":"ライムライト","items":3}],` +
		`"patch_dirs":[{"path":"","items":1},{"path":"汉化补丁 v1.1","items":2}],` +
		`"added":[{"path":"LimelightLemonadeJam_chs.exe","size":942,"old_size":null}],"replaced":[{"path":"patch.xp3","size":146,"old_size":121}],"conflicts":[],` +
		`"adds":{"files":1,"size":942},"replaces":{"files":1,"size":146},"unchanged":{"files":2,"size":5900},"total":{"files":4,"size":6988}},` +
		`"folders":[{"role":"game","name":"ライムライト","items":4,"size":6988},{"role":"patch","name":"汉化补丁","items":1,"size":850}],` +
		`"file_name":"","estimated_size":8200,"size":null,"ahead":0,"step":null,"percent":0,` +
		`"steps":[{"step":"fetch","state":"waiting","seconds":null},{"step":"unpack","state":"waiting","seconds":null},{"step":"apply","state":"waiting","seconds":null},` +
		`{"step":"pack","state":"waiting","seconds":null},{"step":"check","state":"waiting","seconds":null},{"step":"store","state":"waiting","seconds":null}],` +
		`"failure":null,"failure_detail":null,"queued_at":null,"started_at":null,"finished_at":null,"updated":"2026-10-03T01:02:03.000Z"}`
	if string(resp.Data) != want {
		t.Fatalf("a draft with its plan:\n%s\nwant\n%s", resp.Data, want)
	}
	if without := e.call(t, http.MethodDelete, at(draft.ID)+"/patch", nil); without.Patch != nil || without.Plan != nil {
		t.Fatalf("a draft without its patch: %+v", without)
	}
	e.call(t, http.MethodPut, at(draft.ID)+"/patch", map[string]any{"upload_session_id": nextUpload, "file_name": patchName})
	e.read(t, draft.ID, composition.RolePatch)
	moved := e.call(t, http.MethodPatch, at(draft.ID), map[string]any{"language": []string{"zh"}, "translation": "group", "translators": []string{"绿茶汉化组"}, "patch_version": "v1.1", "keep_patch": false, "patch_dir": ""})
	if string(e.server.Do(apitest.Request{Method: http.MethodGet, Path: at(draft.ID), As: &uploader}).Data) == want {
		t.Fatal("an edit changes what the draft shows")
	}
	if moved.Plan.PatchDir != "" || moved.KeepPatch || moved.FileName == "" {
		t.Fatalf("an edited draft: %+v", moved)
	}
	if kept := e.call(t, http.MethodPatch, at(draft.ID), details); kept.Plan.PatchDir != "" || !kept.KeepPatch {
		t.Fatalf("a folder chosen before stays when an edit leaves it out: %+v", kept)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: at(draft.ID), As: &uploader, Body: map[string]any{"language": []string{"fr"}, "translators": []string{}, "keep_patch": true}}), http.StatusUnprocessableEntity, 100101)
}

func TestTheSaveComesAndGoes(t *testing.T) {
	e := setup(t)
	draft := e.described(t)
	with := e.call(t, http.MethodPut, at(draft.ID)+"/save", map[string]any{"upload_session_id": saveUpload, "file_name": saveName})
	if with.Save == nil || with.Save.State != "reading" {
		t.Fatalf("a save that is being read: %+v", with)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: at(draft.ID) + "/start", As: &uploader}), http.StatusConflict, 660105)
	e.read(t, draft.ID, composition.RoleSave)
	if read := e.call(t, http.MethodGet, at(draft.ID), nil); read.Save.State != "ready" {
		t.Fatalf("a save that is read: %+v", read)
	}
	if without := e.call(t, http.MethodDelete, at(draft.ID)+"/save", nil); without.Save != nil {
		t.Fatalf("a draft without its save: %+v", without)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: at(draft.ID) + "/save", As: &uploader, Body: map[string]any{"upload_session_id": 999, "file_name": saveName}}), http.StatusNotFound, 480104)
}

func TestStartingQueuesTheWorkAndOnlyAFailedOneIsRetried(t *testing.T) {
	e := setup(t)
	draft := e.described(t)
	started := e.call(t, http.MethodPost, at(draft.ID)+"/start", nil)
	if started.State != "queued" || started.ResourceID == nil || started.FileName != draft.FileName {
		t.Fatalf("a started composition: %+v", started)
	}
	if jobs := e.events.Jobs(); len(jobs) != 2 || jobs[1] != (composition.Run{CompositionID: draft.ID}) {
		t.Fatalf("queued work: %+v", jobs)
	}
	mine := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/composition/mine", As: &uploader})
	e.server.Expect(mine, http.StatusOK, 0)
	var listed []shown
	mine.Decode(t, &listed)
	if len(listed) != 1 || listed[0].ID != draft.ID {
		t.Fatalf("my compositions: %s", mine.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: at(draft.ID), As: &uploader, Body: details}), http.StatusConflict, 660104)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: at(draft.ID) + "/patch", As: &uploader, Body: map[string]any{"upload_session_id": nextUpload, "file_name": nextPatch}}), http.StatusConflict, 660104)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: at(draft.ID) + "/retry", As: &uploader}), http.StatusConflict, 660109)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: at(draft.ID), As: &uploader}), http.StatusConflict, 660111)

	e.examiner.Err = context.DeadlineExceeded
	if err := e.runs.Run(context.Background(), draft.ID); err == nil {
		t.Fatal("a check that times out is tried again")
	}
	if err := e.runs.GiveUp(context.Background(), draft.ID, context.DeadlineExceeded); err != nil {
		t.Fatal(err)
	}
	e.examiner.Err = nil
	if failed := e.call(t, http.MethodGet, at(draft.ID), nil); failed.State != "failed" || *failed.Failure != "internal" {
		t.Fatalf("a failed composition: %+v", failed)
	}
	if retried := e.call(t, http.MethodPost, at(draft.ID)+"/retry", nil); retried.State != "queued" {
		t.Fatalf("a retried composition: %+v", retried)
	}
}

func TestACompositionIsItsOwnersAlone(t *testing.T) {
	e := setup(t)
	draft := e.described(t)
	for _, call := range []apitest.Request{
		{Method: http.MethodGet, Path: at(draft.ID)},
		{Method: http.MethodPatch, Path: at(draft.ID), Body: details},
		{Method: http.MethodPut, Path: at(draft.ID) + "/patch", Body: map[string]any{"upload_session_id": nextUpload, "file_name": nextPatch}},
		{Method: http.MethodPost, Path: at(draft.ID) + "/start"},
		{Method: http.MethodDelete, Path: at(draft.ID)},
	} {
		e.server.Expect(e.server.Do(call), http.StatusUnauthorized, 200101)
		call.As = &stranger
		e.server.Expect(e.server.Do(call), http.StatusForbidden, 660102)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: at(999), As: &uploader}), http.StatusNotFound, 660101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/composition", As: &uploader, Body: map[string]any{"base_resource_id": discID}}), http.StatusConflict, 660103)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/composition", As: &uploader, Body: map[string]any{"base_resource_id": 999}}), http.StatusConflict, 660112)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: at(draft.ID), As: &uploader}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: at(draft.ID), As: &uploader}), http.StatusNotFound, 660101)
}

func TestAComposedResourceSaysWhatItIsMadeOfAndTakesANewPatch(t *testing.T) {
	e := setup(t)
	done := e.composed(t)
	path := "/game/download-source/" + at(*done.ResourceID)[len("/composition/"):] + "/composition"
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"current":null,"latest":{"id":1,"base":{"resource_id":31,"name":"[250926][ゆずソフト] ライムライト DL版 (files).7z","size":6500},"base_gone":false,` +
		`"patch":{"name":"汉化补丁_v1.1.zip","size":850},"save":null,"patch_version":"v1.1","keep_patch":true,"finished_at":"2026-10-03T01:02:03.000Z"}}`
	if string(resp.Data) != want {
		t.Fatalf("what a resource is made of:\n%s\nwant\n%s", resp.Data, want)
	}
	uploaded := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/77/composition"})
	e.server.Expect(uploaded, http.StatusOK, 0)
	if string(uploaded.Data) != `{"current":null,"latest":null}` {
		t.Fatalf("an uploaded resource: %s", uploaded.Data)
	}

	body := map[string]any{"upload_session_id": nextUpload, "file_name": nextPatch, "patch_version": "v1.2", "note": "修正第三章的错字"}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, Body: body}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &stranger, Body: body}), http.StatusForbidden, 440102)
	rebuilt := e.call(t, http.MethodPost, path, body)
	if !rebuilt.Rebuild || rebuilt.State != "draft" || rebuilt.Patch.Name != nextPatch || *rebuilt.ResourceID != *done.ResourceID {
		t.Fatalf("a composition with a new patch: %+v", rebuilt)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &uploader, Body: body}), http.StatusConflict, 660111)

	var lineage struct {
		Current *shown `json:"current"`
	}
	mine := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &uploader})
	e.server.Expect(mine, http.StatusOK, 0)
	mine.Decode(t, &lineage)
	if lineage.Current == nil || lineage.Current.ID != rebuilt.ID {
		t.Fatalf("the owner sees the composition under way: %s", mine.Data)
	}
	theirs := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &stranger})
	theirs.Decode(t, &lineage)
	if lineage.Current != nil {
		t.Fatalf("nobody else sees it: %s", theirs.Data)
	}

	e.read(t, rebuilt.ID, composition.RolePatch)
	if queued := e.call(t, http.MethodGet, at(rebuilt.ID), nil); queued.State != "queued" {
		t.Fatalf("a rebuild starts itself once its patch is read: %+v", queued)
	}
}
