package s3store_test

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/s3store"
	"github.com/Ringyuki/shionlib/apps/api/internal/backup"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
)

type fakeS3 struct {
	mu        sync.Mutex
	objects   map[string][]byte
	types     map[string]string
	modified  map[string]time.Time
	parts     map[string]map[int][]byte
	completed int
	aborted   int
	puts      int
	failPart  int
}

func newFakeS3(t *testing.T) (*fakeS3, *httptest.Server) {
	t.Helper()
	fake := &fakeS3{objects: map[string][]byte{}, types: map[string]string{}, modified: map[string]time.Time{}, parts: map[string]map[int][]byte{}}
	server := httptest.NewServer(http.HandlerFunc(fake.serve))
	t.Cleanup(server.Close)
	return fake, server
}

func (f *fakeS3) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	path := strings.TrimPrefix(r.URL.Path, "/backups")
	key := strings.TrimPrefix(path, "/")
	query := r.URL.Query()
	body, _ := io.ReadAll(r.Body)
	switch {
	case r.Method == http.MethodGet && key == "" && query.Get("list-type") == "2":
		f.list(w, query.Get("prefix"))
	case r.Method == http.MethodPost && query.Has("uploads"):
		f.parts["upload-1"] = map[int][]byte{}
		writeXML(w, `<InitiateMultipartUploadResult><Bucket>backups</Bucket><Key>`+key+`</Key><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>`)
	case r.Method == http.MethodPut && query.Has("uploadId"):
		number, _ := strconv.Atoi(query.Get("partNumber"))
		if number == f.failPart {
			w.WriteHeader(http.StatusInternalServerError)
			writeXML(w, `<Error><Code>InternalError</Code><Message>boom</Message></Error>`)
			return
		}
		f.parts[query.Get("uploadId")][number] = body
		w.Header().Set("ETag", fmt.Sprintf(`"etag-%d"`, number))
	case r.Method == http.MethodPost && query.Has("uploadId"):
		parts := f.parts[query.Get("uploadId")]
		numbers := make([]int, 0, len(parts))
		for number := range parts {
			numbers = append(numbers, number)
		}
		sort.Ints(numbers)
		var joined []byte
		for _, number := range numbers {
			joined = append(joined, parts[number]...)
		}
		f.objects[key] = joined
		f.modified[key] = time.Now().UTC()
		f.completed++
		writeXML(w, `<CompleteMultipartUploadResult><Bucket>backups</Bucket><Key>`+key+`</Key><ETag>"done"</ETag></CompleteMultipartUploadResult>`)
	case r.Method == http.MethodDelete && query.Has("uploadId"):
		f.aborted++
		w.WriteHeader(http.StatusNoContent)
	case r.Method == http.MethodPut:
		f.objects[key] = body
		f.types[key] = r.Header.Get("Content-Type")
		f.modified[key] = time.Now().UTC()
		f.puts++
		w.Header().Set("ETag", `"single"`)
	case r.Method == http.MethodDelete:
		delete(f.objects, key)
		w.WriteHeader(http.StatusNoContent)
	case r.Method == http.MethodGet:
		data, ok := f.objects[key]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			writeXML(w, `<Error><Code>NoSuchKey</Code><Message>missing</Message></Error>`)
			return
		}
		w.Header().Set("Content-Type", f.types[key])
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		_, _ = w.Write(data)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (f *fakeS3) list(w http.ResponseWriter, prefix string) {
	type content struct {
		Key          string `xml:"Key"`
		LastModified string `xml:"LastModified"`
		Size         int    `xml:"Size"`
	}
	result := struct {
		XMLName     xml.Name  `xml:"ListBucketResult"`
		Name        string    `xml:"Name"`
		Prefix      string    `xml:"Prefix"`
		KeyCount    int       `xml:"KeyCount"`
		IsTruncated bool      `xml:"IsTruncated"`
		Contents    []content `xml:"Contents"`
	}{Name: "backups", Prefix: prefix}
	keys := make([]string, 0, len(f.objects))
	for key := range f.objects {
		if strings.HasPrefix(key, prefix) {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	for _, key := range keys {
		result.Contents = append(result.Contents, content{Key: key, LastModified: f.modified[key].Format(time.RFC3339), Size: len(f.objects[key])})
	}
	result.KeyCount = len(result.Contents)
	raw, _ := xml.Marshal(result)
	writeXML(w, string(raw))
}

func writeXML(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "application/xml")
	_, _ = w.Write([]byte(body))
}

func newBucket(server *httptest.Server, partSize int64) *s3store.Bucket {
	return s3store.New(s3store.Options{
		Bucket:     config.Bucket{Bucket: "backups", Region: "auto", Endpoint: server.URL, AccessKeyID: "id", SecretAccessKey: "secret"},
		HTTPClient: server.Client(),
		PathStyle:  true,
		PartSize:   partSize,
	})
}

func TestSmallUploadUsesASinglePut(t *testing.T) {
	fake, server := newFakeS3(t)
	bucket := newBucket(server, 1024)
	if err := bucket.Upload(context.Background(), "backup/database/daily/a.shionlibbackup", "application/octet-stream", strings.NewReader("tiny")); err != nil {
		t.Fatal(err)
	}
	if fake.puts != 1 || string(fake.objects["backup/database/daily/a.shionlibbackup"]) != "tiny" || fake.types["backup/database/daily/a.shionlibbackup"] != "application/octet-stream" {
		t.Fatalf("unexpected store state %+v", fake.objects)
	}
}

func TestLargeUploadStreamsParts(t *testing.T) {
	fake, server := newFakeS3(t)
	bucket := newBucket(server, 4)
	payload := "0123456789abcdefghij-"
	if err := bucket.Upload(context.Background(), "big", "application/octet-stream", strings.NewReader(payload)); err != nil {
		t.Fatal(err)
	}
	if fake.completed != 1 || string(fake.objects["big"]) != payload || len(fake.parts["upload-1"]) != 6 {
		t.Fatalf("multipart upload: %q parts=%d", fake.objects["big"], len(fake.parts["upload-1"]))
	}
	exact := "01234567"
	if err := bucket.Upload(context.Background(), "exact", "application/octet-stream", strings.NewReader(exact)); err != nil {
		t.Fatal(err)
	}
	if string(fake.objects["exact"]) != exact {
		t.Fatalf("part-aligned upload: %q", fake.objects["exact"])
	}
}

type failingReader struct {
	data string
}

func (r *failingReader) Read(p []byte) (int, error) {
	if r.data == "" {
		return 0, errors.New("pg_dump failed")
	}
	n := copy(p, r.data)
	r.data = r.data[n:]
	return n, nil
}

func TestFailedStreamsAbortTheUpload(t *testing.T) {
	fake, server := newFakeS3(t)
	bucket := newBucket(server, 4)
	err := bucket.Upload(context.Background(), "broken", "application/octet-stream", &failingReader{data: "0123456789"})
	if err == nil || !strings.Contains(err.Error(), "pg_dump failed") {
		t.Fatalf("expected the reader error, got %v", err)
	}
	if fake.aborted != 1 || fake.completed != 0 {
		t.Fatalf("a broken stream must abort the multipart upload: aborted=%d completed=%d", fake.aborted, fake.completed)
	}
	if _, ok := fake.objects["broken"]; ok {
		t.Fatal("no object may be created from a broken stream")
	}
	fake.failPart = 2
	if err := bucket.Upload(context.Background(), "part-failure", "application/octet-stream", strings.NewReader("0123456789")); err == nil || fake.aborted != 2 {
		t.Fatalf("part failures abort: %v aborted=%d", err, fake.aborted)
	}
	if err := bucket.Upload(context.Background(), "short", "application/octet-stream", &failingReader{data: "01"}); err == nil || fake.puts != 0 {
		t.Fatalf("a failing first part must not be uploaded: %v puts=%d", err, fake.puts)
	}
}

func TestBackupStoreListAndDelete(t *testing.T) {
	_, server := newFakeS3(t)
	store := s3store.NewBackupStore(newBucket(server, 1024))
	ctx := context.Background()
	for _, key := range []string{"backup/database/daily/1", "backup/database/daily/2", "backup/database/weekly/1"} {
		if err := store.Upload(ctx, key, backup.ContentType, strings.NewReader("x")); err != nil {
			t.Fatal(err)
		}
	}
	objects, err := store.List(ctx, "backup/database/daily/")
	if err != nil || len(objects) != 2 || objects[0].Key != "backup/database/daily/1" || objects[0].LastModified.IsZero() {
		t.Fatalf("list: %+v %v", objects, err)
	}
	if err := store.Delete(ctx, "backup/database/daily/1"); err != nil {
		t.Fatal(err)
	}
	objects, _ = store.List(ctx, "backup/database/daily/")
	if len(objects) != 1 {
		t.Fatalf("delete: %+v", objects)
	}
}

func TestCoverStore(t *testing.T) {
	fake, server := newFakeS3(t)
	fake.objects["covers/a.webp"] = []byte("image-bytes")
	fake.types["covers/a.webp"] = "image/webp"
	covers := s3store.NewCoverStore(newBucket(server, 1024))
	cover, err := covers.Fetch(context.Background(), "covers/a.webp", 1024)
	if err != nil || string(cover.Data) != "image-bytes" || cover.ContentType != "image/webp" {
		t.Fatalf("fetch: %+v %v", cover, err)
	}
	if _, err := covers.Fetch(context.Background(), "covers/a.webp", 4); err == nil {
		t.Fatal("oversized covers are refused")
	}
	if _, err := covers.Fetch(context.Background(), "covers/missing.webp", 1024); err == nil {
		t.Fatal("missing covers fail")
	}
}

func TestUnconfiguredBucket(t *testing.T) {
	bucket := s3store.New(s3store.Options{})
	if err := bucket.Upload(context.Background(), "k", "t", strings.NewReader("x")); !errors.Is(err, s3store.ErrNotConfigured) {
		t.Fatalf("upload: %v", err)
	}
	if _, err := bucket.List(context.Background(), "p"); !errors.Is(err, s3store.ErrNotConfigured) {
		t.Fatalf("list: %v", err)
	}
}
