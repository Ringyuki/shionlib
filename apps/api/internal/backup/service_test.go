package backup_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/backup"
)

type dumper struct {
	data   string
	fail   error
	closed bool
}

func (d *dumper) Dump(context.Context) (io.ReadCloser, error) {
	if d.fail != nil {
		return nil, d.fail
	}
	return d, nil
}

func (d *dumper) Read(p []byte) (int, error) {
	if d.data == "" {
		return 0, io.EOF
	}
	n := copy(p, d.data)
	d.data = d.data[n:]
	return n, nil
}

func (d *dumper) Close() error {
	d.closed = true
	return nil
}

type store struct {
	objects map[string]backup.Object
	bodies  map[string]string
	types   map[string]string
	fail    error
}

func newStore() *store {
	return &store{objects: map[string]backup.Object{}, bodies: map[string]string{}, types: map[string]string{}}
}

func (s *store) Upload(_ context.Context, key, contentType string, body io.Reader) error {
	if s.fail != nil {
		return s.fail
	}
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, body); err != nil {
		return err
	}
	s.bodies[key] = buf.String()
	s.types[key] = contentType
	s.objects[key] = backup.Object{Key: key, LastModified: time.Date(2026, 10, 3, 2, 0, 0, 0, time.UTC)}
	return nil
}

func (s *store) List(_ context.Context, prefix string) ([]backup.Object, error) {
	var out []backup.Object
	for key, object := range s.objects {
		if strings.HasPrefix(key, prefix) {
			out = append(out, object)
		}
	}
	return out, nil
}

func (s *store) Delete(_ context.Context, key string) error {
	delete(s.objects, key)
	return nil
}

func (s *store) keys(prefix string) []string {
	var out []string
	for key := range s.objects {
		if strings.HasPrefix(key, prefix) {
			out = append(out, key)
		}
	}
	slices.Sort(out)
	return out
}

func TestRunUploadsAndPrunes(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 3, 2, 0, 0, 123_000_000, time.UTC)
	objects := newStore()
	for _, day := range []int{1, 2} {
		key := "backup/database/daily/2026-10-0" + string(rune('0'+day)) + "T02-00-00.000Z.shionlibbackup"
		objects.objects[key] = backup.Object{Key: key, LastModified: time.Date(2026, 10, day, 2, 0, 0, 0, time.UTC)}
	}
	objects.objects["backup/database/weekly/old.shionlibbackup"] = backup.Object{Key: "backup/database/weekly/old.shionlibbackup"}
	dump := &dumper{data: "PGDMP-data"}
	service := backup.NewService(dump, objects, backup.Retention{Daily: 2, Weekly: 4}, func() time.Time { return now })

	if err := service.RunDaily(ctx); err != nil {
		t.Fatal(err)
	}
	key := "backup/database/daily/2026-10-03T02-00-00.123Z.shionlibbackup"
	if objects.bodies[key] != "PGDMP-data" || objects.types[key] != "application/octet-stream" || !dump.closed {
		t.Fatalf("dump is streamed to %s: %v", key, objects.keys(""))
	}
	daily := objects.keys("backup/database/daily/")
	if !slices.Equal(daily, []string{"backup/database/daily/2026-10-02T02-00-00.000Z.shionlibbackup", key}) {
		t.Fatalf("only the newest daily backups are kept: %v", daily)
	}
	if len(objects.keys("backup/database/weekly/")) != 1 {
		t.Fatal("pruning is scoped to the tier")
	}
}

func TestRunWithoutRetentionKeepsEverything(t *testing.T) {
	objects := newStore()
	for i := range 5 {
		key := "backup/database/weekly/" + string(rune('a'+i))
		objects.objects[key] = backup.Object{Key: key}
	}
	service := backup.NewService(&dumper{data: "x"}, objects, backup.Retention{}, time.Now)
	if err := service.RunWeekly(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(objects.keys("backup/database/weekly/")) != 6 {
		t.Fatalf("retention 0 disables pruning: %v", objects.keys(""))
	}
}

func TestRunFailures(t *testing.T) {
	ctx := context.Background()
	failing := backup.NewService(&dumper{fail: errors.New("pg_dump missing")}, newStore(), backup.Retention{Daily: 1}, time.Now)
	if err := failing.RunDaily(ctx); err == nil || !strings.Contains(err.Error(), "pg_dump missing") {
		t.Fatalf("dump start failures surface: %v", err)
	}
	objects := newStore()
	objects.fail = errors.New("bucket down")
	dump := &dumper{data: "x"}
	if err := backup.NewService(dump, objects, backup.Retention{Daily: 1}, time.Now).RunDaily(ctx); err == nil || !dump.closed {
		t.Fatalf("upload failures surface and release the dump: %v", err)
	}
}
