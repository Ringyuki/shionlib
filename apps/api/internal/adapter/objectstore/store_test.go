package objectstore_test

import (
	"bytes"
	"crypto/rand"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

var _ download.ObjectStore = (*objectstore.Store)(nil)

type version struct {
	Key      string
	ID       string
	Modified time.Time
	Marker   bool
}

type fakeS3 struct {
	mu         sync.Mutex
	puts       map[string][]byte
	headers    map[string]http.Header
	parts      map[int][]byte
	completed  []int
	aborted    bool
	failPart   bool
	versions   []version
	deleted    []string
	listCalls  int
	pageSize   int
	uploadType string
}

func newFakeS3(t *testing.T) (*fakeS3, *objectstore.Store, func(int64) *objectstore.Store) {
	t.Helper()
	fake := &fakeS3{puts: map[string][]byte{}, headers: map[string]http.Header{}, parts: map[int][]byte{}}
	server := httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(server.Close)
	build := func(partSize int64) *objectstore.Store {
		return objectstore.New(objectstore.Options{
			Bucket:          "games",
			Endpoint:        server.URL,
			AccessKeyID:     "id",
			SecretAccessKey: "secret",
			PathStyle:       true,
			HTTPClient:      httpclient.New(httpclient.Options{Timeout: 5 * time.Second}),
			PartSize:        partSize,
			Concurrency:     2,
		})
	}
	return fake, build(0), build
}

func (f *fakeS3) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	query := r.URL.Query()
	key := strings.TrimPrefix(r.URL.Path, "/games/")
	body, _ := io.ReadAll(r.Body)
	switch {
	case r.Method == http.MethodPut && query.Has("partNumber"):
		number, _ := strconv.Atoi(query.Get("partNumber"))
		if f.failPart && number == 2 {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`<Error><Code>InternalError</Code><Message>boom</Message></Error>`))
			return
		}
		f.parts[number] = body
		w.Header().Set("ETag", fmt.Sprintf(`"etag-%d"`, number))
	case r.Method == http.MethodPut:
		f.puts[key] = body
		f.headers[key] = r.Header.Clone()
	case r.Method == http.MethodPost && query.Has("uploads"):
		f.uploadType = r.Header.Get("Content-Type")
		f.headers[key] = r.Header.Clone()
		_, _ = fmt.Fprintf(w, `<InitiateMultipartUploadResult><Bucket>games</Bucket><Key>%s</Key><UploadId>up-1</UploadId></InitiateMultipartUploadResult>`, key)
	case r.Method == http.MethodPost && query.Get("uploadId") == "up-1":
		var complete struct {
			Parts []struct {
				PartNumber int
				ETag       string
			} `xml:"Part"`
		}
		_ = xml.Unmarshal(body, &complete)
		for _, part := range complete.Parts {
			if part.ETag != fmt.Sprintf(`"etag-%d"`, part.PartNumber) {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			f.completed = append(f.completed, part.PartNumber)
		}
		_, _ = fmt.Fprintf(w, `<CompleteMultipartUploadResult><Bucket>games</Bucket><Key>%s</Key><ETag>"done"</ETag></CompleteMultipartUploadResult>`, key)
	case r.Method == http.MethodDelete && query.Get("uploadId") == "up-1":
		f.aborted = true
		w.WriteHeader(http.StatusNoContent)
	case r.Method == http.MethodGet && query.Has("versions"):
		f.listVersions(w, query)
	case r.Method == http.MethodPost && query.Has("delete"):
		var request struct {
			Objects []struct {
				Key       string
				VersionId string
			} `xml:"Object"`
			Quiet bool
		}
		_ = xml.Unmarshal(body, &request)
		if !request.Quiet {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		for _, object := range request.Objects {
			f.deleted = append(f.deleted, object.Key+"@"+object.VersionId)
		}
		_, _ = w.Write([]byte(`<DeleteResult></DeleteResult>`))
	case r.Method == http.MethodGet && query.Get("list-type") == "2":
		_, _ = w.Write([]byte(`<ListBucketResult><Name>games</Name><Prefix></Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>true</IsTruncated><NextContinuationToken>next</NextContinuationToken><Contents><Key>games/1/2/a.7z</Key><LastModified>2026-10-01T02:03:04.000Z</LastModified><ETag>"abc"</ETag><Size>42</Size><StorageClass>STANDARD</StorageClass></Contents><Contents><Key>games/1/3/b.7z</Key><LastModified>2026-10-02T02:03:04.000Z</LastModified><ETag>"def"</ETag><Size>7</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>`))
	default:
		w.WriteHeader(http.StatusNotImplemented)
	}
}

func (f *fakeS3) listVersions(w http.ResponseWriter, query map[string][]string) {
	f.listCalls++
	prefix := firstOf(query, "prefix")
	marker := firstOf(query, "version-id-marker")
	var matching []version
	for _, v := range f.versions {
		if strings.HasPrefix(v.Key, prefix) {
			matching = append(matching, v)
		}
	}
	start := 0
	if marker != "" {
		start = slices.IndexFunc(matching, func(v version) bool { return v.ID == marker }) + 1
	}
	end := min(len(matching), start+f.pageSize)
	var buf bytes.Buffer
	buf.WriteString(`<ListVersionsResult><Name>games</Name>`)
	if end < len(matching) {
		fmt.Fprintf(&buf, `<IsTruncated>true</IsTruncated><NextKeyMarker>%s</NextKeyMarker><NextVersionIdMarker>%s</NextVersionIdMarker>`, matching[end-1].Key, matching[end-1].ID)
	} else {
		buf.WriteString(`<IsTruncated>false</IsTruncated>`)
	}
	for _, v := range matching[start:end] {
		tag := "Version"
		if v.Marker {
			tag = "DeleteMarker"
		}
		fmt.Fprintf(&buf, `<%s><Key>%s</Key><VersionId>%s</VersionId><LastModified>%s</LastModified></%s>`, tag, v.Key, v.ID, v.Modified.UTC().Format(time.RFC3339), tag)
	}
	buf.WriteString(`</ListVersionsResult>`)
	_, _ = w.Write(buf.Bytes())
}

func firstOf(query map[string][]string, key string) string {
	if values := query[key]; len(values) > 0 {
		return values[0]
	}
	return ""
}

func tempFile(t *testing.T, size int) (string, []byte) {
	t.Helper()
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "upload.sltf")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return path, data
}

func TestPutSmallObjectWithMetadata(t *testing.T) {
	fake, store, _ := newFakeS3(t)
	path, data := tempFile(t, 1024)
	err := store.Put(t.Context(), download.Object{
		Key:         "games/12/34/ゲーム.7z",
		LocalPath:   path,
		ContentType: "application/x-7z-compressed",
		Metadata:    map[string]string{"game-id": "12", "uploader-id": "5", "file-sha256": "abc"},
	})
	if err != nil {
		t.Fatal(err)
	}
	fake.mu.Lock()
	defer fake.mu.Unlock()
	got, ok := fake.puts["games/12/34/ゲーム.7z"]
	if !ok || !bytes.Equal(got, data) {
		t.Fatalf("object not stored: %v", sortedKeys(fake.puts))
	}
	header := fake.headers["games/12/34/ゲーム.7z"]
	if header.Get("Content-Type") != "application/x-7z-compressed" || header.Get("X-Amz-Meta-Game-Id") != "12" || header.Get("X-Amz-Meta-Uploader-Id") != "5" || header.Get("X-Amz-Meta-File-Sha256") != "abc" {
		t.Fatalf("unexpected headers %v", header)
	}
	if !strings.HasPrefix(header.Get("Authorization"), "AWS4-HMAC-SHA256 Credential=id/") {
		t.Fatalf("request must be signed: %s", header.Get("Authorization"))
	}
}

func TestPutLargeObjectUsesMultipart(t *testing.T) {
	fake, _, build := newFakeS3(t)
	path, data := tempFile(t, 11<<20)
	store := build(5 << 20)
	if err := store.Put(t.Context(), download.Object{Key: "games/1/2/big.7z", LocalPath: path, ContentType: "application/octet-stream", Metadata: map[string]string{"game-id": "1"}}); err != nil {
		t.Fatal(err)
	}
	fake.mu.Lock()
	defer fake.mu.Unlock()
	if len(fake.parts) != 3 || !slices.Equal(fake.completed, []int{1, 2, 3}) || fake.aborted {
		t.Fatalf("parts %d completed %v aborted %v", len(fake.parts), fake.completed, fake.aborted)
	}
	joined := slices.Concat(fake.parts[1], fake.parts[2], fake.parts[3])
	if !bytes.Equal(joined, data) || len(fake.parts[3]) != 1<<20 {
		t.Fatal("parts do not reassemble the file")
	}
	if fake.uploadType != "application/octet-stream" || fake.headers["games/1/2/big.7z"].Get("X-Amz-Meta-Game-Id") != "1" {
		t.Fatalf("multipart creation lost metadata: %v", fake.headers["games/1/2/big.7z"])
	}
}

func TestPutAbortsFailedMultipart(t *testing.T) {
	fake, _, build := newFakeS3(t)
	fake.failPart = true
	path, _ := tempFile(t, 11<<20)
	err := build(5<<20).Put(t.Context(), download.Object{Key: "games/1/2/big.7z", LocalPath: path, ContentType: "application/octet-stream"})
	if err == nil {
		t.Fatal("a failed part must fail the upload")
	}
	fake.mu.Lock()
	defer fake.mu.Unlock()
	if !fake.aborted || len(fake.completed) != 0 {
		t.Fatalf("aborted %v completed %v", fake.aborted, fake.completed)
	}
	if err := build(0).Put(t.Context(), download.Object{Key: "x", LocalPath: filepath.Join(t.TempDir(), "missing")}); err == nil {
		t.Fatal("missing local files must fail")
	}
}

func TestDeleteRemovesEveryVersionOfTheExactKey(t *testing.T) {
	fake, store, _ := newFakeS3(t)
	base := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	fake.pageSize = 2
	fake.versions = []version{
		{Key: "games/1/2/a.7z", ID: "v1", Modified: base},
		{Key: "games/1/2/a.7z", ID: "v2", Modified: base.Add(time.Hour), Marker: true},
		{Key: "games/1/2/a.7z.bak", ID: "v3", Modified: base},
		{Key: "games/1/2/a.7z", ID: "v4", Modified: base.Add(2 * time.Hour)},
	}
	if err := store.Delete(t.Context(), "games/1/2/a.7z"); err != nil {
		t.Fatal(err)
	}
	fake.mu.Lock()
	deleted, calls := slices.Clone(fake.deleted), fake.listCalls
	fake.deleted = nil
	fake.mu.Unlock()
	slices.Sort(deleted)
	if !slices.Equal(deleted, []string{"games/1/2/a.7z@v1", "games/1/2/a.7z@v2", "games/1/2/a.7z@v4"}) || calls != 2 {
		t.Fatalf("deleted %v after %d pages", deleted, calls)
	}
	if err := store.DeleteVersionsBefore(t.Context(), "games/1/2/a.7z", base.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	fake.mu.Lock()
	deleted = slices.Clone(fake.deleted)
	fake.deleted = nil
	fake.mu.Unlock()
	slices.Sort(deleted)
	if !slices.Equal(deleted, []string{"games/1/2/a.7z@v1", "games/1/2/a.7z@v2"}) {
		t.Fatalf("versions newer than the cutoff must survive: %v", deleted)
	}
	if err := store.Delete(t.Context(), "games/none"); err != nil {
		t.Fatal(err)
	}
	fake.mu.Lock()
	defer fake.mu.Unlock()
	if len(fake.deleted) != 0 {
		t.Fatalf("nothing to delete must not call DeleteObjects: %v", fake.deleted)
	}
}

func TestListMapsTheFirstPage(t *testing.T) {
	_, store, _ := newFakeS3(t)
	listing, err := store.List(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if listing.Name != "games" || listing.KeyCount != 2 || listing.MaxKeys != 1000 || !listing.IsTruncated || listing.NextContinuationToken != "next" || len(listing.Objects) != 2 {
		t.Fatalf("unexpected listing %+v", listing)
	}
	first := listing.Objects[0]
	if first.Key != "games/1/2/a.7z" || first.ETag != `"abc"` || first.Size != 42 || first.StorageClass != "STANDARD" || first.LastModified == nil || !first.LastModified.Equal(time.Date(2026, 10, 1, 2, 3, 4, 0, time.UTC)) {
		t.Fatalf("unexpected object %+v", first)
	}
}

func sortedKeys(m map[string][]byte) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}
