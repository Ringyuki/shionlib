package inspectionhttp_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection/inspectiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/inspectionhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

type fixture struct {
	server    *apitest.Server
	repo      *inspectiontest.MemoryRepository
	resources *inspectiontest.Resources
	records   *inspection.RecordService
	resource  int
}

func setup(t *testing.T) fixture {
	t.Helper()
	server := apitest.New(t)
	repo := inspectiontest.NewMemoryRepository()
	resources := &inspectiontest.Resources{Visible: map[int][]int{}}
	previews := inspectiontest.NewPreviewStore()
	inspectionhttp.NewHandler(inspection.NewService(repo, resources), inspection.NewPreviewService(repo, resources, previews), server.Builder).Register(server.API)
	records := inspection.NewRecordService(repo, previews, inspectiontest.ImageShrinker{}, &txtest.Immediate{}, func() time.Time { return apitest.Now })
	return fixture{server: server, repo: repo, resources: resources, records: records, resource: repo.NewResource()}
}

func (f fixture) record(t *testing.T) inspection.Recorded {
	t.Helper()
	signatures := time.Date(2025, 11, 26, 9, 30, 45, 0, time.UTC)
	scanned := time.Date(2025, 11, 27, 14, 31, 0, 0, time.UTC)
	modified := time.Date(2013, 7, 27, 4, 0, 0, 0, time.UTC)
	draft := inspection.Draft{
		ResourceID: f.resource,
		Status:     inspection.StatusReady,
		Archive:    inspection.Archive{Format: "rar5", Volumes: 1, Recovery: true, RecoveryPercent: 3},
		Verified:   true,
		Scan:       inspection.Scan{Engine: "ClamAV 1.4.3", SignaturesAt: &signatures, Scanned: 2, Skipped: []string{"Game/huge.dll"}, Limit: 4000 << 20, At: &scanned},
	}
	root := draft.AddTop(inspection.DraftEntry{Name: "Annaffiare", Kind: inspection.KindFolder, Modified: &modified})
	disc := draft.Add(inspection.DraftEntry{Parent: root, Name: "ANNA.iso", Kind: inspection.KindDisc, Size: 1000, Detail: inspection.Detail{Format: "iso9660+joliet", Label: "ANNA", Files: 2, Folders: 0}})
	draft.Add(inspection.DraftEntry{Parent: disc, Name: "setup.exe", Kind: inspection.KindFile, Size: 100})
	draft.Add(inspection.DraftEntry{Parent: disc, Name: "Track 02", Kind: inspection.KindTrack, Size: 300, Detail: inspection.Detail{Track: 2, Seconds: 271}})
	draft.Add(inspection.DraftEntry{Parent: root, Name: "readme.txt", Kind: inspection.KindFile, Size: 5})
	draft.Add(inspection.DraftEntry{Parent: root, Name: "cover.jpg", Kind: inspection.KindFile, Size: 4})
	draft.Add(inspection.DraftEntry{Parent: root, Name: "update.rar", Kind: inspection.KindArchive, Size: 9, Encrypted: true, Unreadable: true})
	recorded, err := f.records.Record(context.Background(), draft)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.records.KeepPreview(context.Background(), recorded.ID, recorded.Entries[4], inspection.PreviewText, strings.NewReader("hello")); err != nil {
		t.Fatal(err)
	}
	if err := f.records.KeepPreview(context.Background(), recorded.ID, recorded.Entries[5], inspection.PreviewImage, strings.NewReader("jpeg")); err != nil {
		t.Fatal(err)
	}
	f.resources.Visible[f.resource] = []int{recorded.ID}
	f.repo.Attach(recorded.ID)
	return recorded
}

func itoa(value int) string {
	return strconv.Itoa(value)
}

func TestOfResourceReturnsWhatTheChecksFound(t *testing.T) {
	f := setup(t)
	empty := f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/resource/" + itoa(f.resource)})
	f.server.Expect(empty, http.StatusOK, 0)
	if string(empty.Data) != `[]` {
		t.Fatalf("unexpected body %s", empty.Data)
	}
	f.record(t)
	resp := f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/resource/" + itoa(f.resource)})
	f.server.Expect(resp, http.StatusOK, 0)
	want := `[{"id":1,"status":"ready","archive":{"format":"rar5","solid":false,"volumes":1,"recovery":true,"recovery_percent":3,"name_encoding":""},` +
		`"files":4,"folders":1,"size":1018,"disc_files":2,"truncated":false,"verified":true,` +
		`"scan":{"engine":"ClamAV 1.4.3","signatures_at":"2025-11-26T09:30:45.000Z","scanned":2,"skipped":["Game/huge.dll"],"limit":4194304000,"detections":[],"at":"2025-11-27T14:31:00.000Z","cleared_at":null},` +
		`"discs":[{"entry_id":2,"name":"ANNA.iso","size":1000,"format":"iso9660+joliet","label":"ANNA","files":2,"folders":0,"unreadable":false,"signals":[]}],`
	if !strings.HasPrefix(string(resp.Data), want) {
		t.Fatalf("unexpected body %s", resp.Data)
	}
	f.resources.Err = download.ErrResourceNotFound
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/resource/" + itoa(f.resource)}), http.StatusNotFound, download.ErrResourceNotFound.Code())
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/resource/0"}), http.StatusUnprocessableEntity, 100101)
}

func TestEntriesListsOneLevelAtATime(t *testing.T) {
	f := setup(t)
	recorded := f.record(t)
	base := "/inspection/" + itoa(recorded.ID) + "/entries"
	top := f.server.Do(apitest.Request{Method: http.MethodGet, Path: base})
	f.server.Expect(top, http.StatusOK, 0)
	want := `{"items":[{"id":1,"parent_id":null,"name":"Annaffiare","kind":"folder","size":1018,"modified":"2013-07-27T04:00:00.000Z","items":4,"children":4,"encrypted":false,"unreadable":false,"preview":null,"track":null}],` +
		`"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":200,"totalPages":1,"currentPage":1}}`
	if string(top.Data) != want {
		t.Fatalf("unexpected body %s", top.Data)
	}
	inside := f.server.Do(apitest.Request{Method: http.MethodGet, Path: base + "?parent_id=1&pageSize=2&page=2"})
	f.server.Expect(inside, http.StatusOK, 0)
	wantInside := `{"items":[{"id":3,"parent_id":1,"name":"readme.txt","kind":"file","size":5,"modified":null,"items":0,"children":0,"encrypted":false,"unreadable":false,"preview":"text","track":null},` +
		`{"id":5,"parent_id":1,"name":"update.rar","kind":"archive","size":9,"modified":null,"items":0,"children":0,"encrypted":true,"unreadable":true,"preview":null,"track":null}],` +
		`"meta":{"totalItems":4,"itemCount":2,"itemsPerPage":2,"totalPages":2,"currentPage":2}}`
	if string(inside.Data) != wantInside {
		t.Fatalf("unexpected body %s", inside.Data)
	}
	disc := f.server.Do(apitest.Request{Method: http.MethodGet, Path: base + "?parent_id=2"})
	if !strings.Contains(string(disc.Data), `"name":"Track 02","kind":"track","size":300,"modified":null,"items":0,"children":0,"encrypted":false,"unreadable":false,"preview":null,"track":{"number":2,"seconds":271}`) {
		t.Fatalf("unexpected body %s", disc.Data)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: base + "?pageSize=201"}), http.StatusUnprocessableEntity, 100101)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/987654/entries"}), http.StatusNotFound, 650101)
	f.resources.Visible[f.resource] = nil
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: base}), http.StatusNotFound, 650101)
}

func TestSearchFindsFilesByName(t *testing.T) {
	f := setup(t)
	recorded := f.record(t)
	base := "/inspection/" + itoa(recorded.ID) + "/search"
	resp := f.server.Do(apitest.Request{Method: http.MethodGet, Path: base + "?q=EXE"})
	f.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":6,"parent_id":2,"name":"setup.exe","kind":"file","size":100,"modified":null,"items":0,"children":0,"encrypted":false,"unreadable":false,"preview":null,"track":null,"location":"Annaffiare/ANNA.iso"}],` +
		`"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":200,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected body %s", resp.Data)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: base}), http.StatusUnprocessableEntity, 100101)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: base + "?q=" + strings.Repeat("a", 101)}), http.StatusUnprocessableEntity, 100101)
	f.resources.Visible[f.resource] = nil
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: base + "?q=exe"}), http.StatusNotFound, 650101)
}

func TestTextReturnsTheBytesWithTheirEncoding(t *testing.T) {
	f := setup(t)
	recorded := f.record(t)
	resp := f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/entry/" + itoa(recorded.Entries[4]) + "/text"})
	f.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"id":3,"name":"readme.txt","size":5,"encoding":"utf-8","content":"aGVsbG8="}` {
		t.Fatalf("unexpected body %s", resp.Data)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/entry/" + itoa(recorded.Entries[5]) + "/text"}), http.StatusNotFound, 650103)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/entry/987654/text"}), http.StatusNotFound, 650102)
	f.resources.Visible[f.resource] = nil
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/entry/" + itoa(recorded.Entries[4]) + "/text"}), http.StatusNotFound, 650102)
}

func TestImageReturnsThePictureAsAnInertWebP(t *testing.T) {
	f := setup(t)
	recorded := f.record(t)
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/inspection/entry/"+itoa(recorded.Entries[5])+"/image", nil)
	request.RemoteAddr = "127.0.0.1:4000"
	resp := httptest.NewRecorder()
	f.server.API.Handler().ServeHTTP(resp, request)
	if resp.Code != http.StatusOK || resp.Body.String() != "webp:jpeg" {
		t.Fatalf("unexpected response %d %q", resp.Code, resp.Body.String())
	}
	for header, want := range map[string]string{
		"Content-Type":            "image/webp",
		"Cache-Control":           "private, max-age=86400",
		"X-Content-Type-Options":  "nosniff",
		"Content-Security-Policy": "default-src 'none'; sandbox",
	} {
		if got := resp.Header().Get(header); got != want {
			t.Fatalf("%s: got %q", header, got)
		}
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/entry/" + itoa(recorded.Entries[4]) + "/image"}), http.StatusNotFound, 650103)
	f.resources.Visible[f.resource] = nil
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/inspection/entry/" + itoa(recorded.Entries[5]) + "/image"}), http.StatusNotFound, 650102)
}
