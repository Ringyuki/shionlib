package download_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

const mib = 1 << 20

type linkFixture struct {
	repo       *downloadtest.MemoryRepository
	challenge  *downloadtest.Challenge
	authorizer *downloadtest.Authorizer
	sealer     *downloadtest.Sealer
	links      *download.LinkService
	file       download.File
}

func newLinkFixture(mode string, size int64) linkFixture {
	repo := downloadtest.NewMemoryRepository(func() time.Time { return now })
	resource := repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1, Updated: now.Add(-time.Hour)})
	key := "games/10/1/ゲーム 体験版.7z"
	file := repo.SeedFile(download.File{ResourceID: resource.ID, Name: "ゲーム 体験版.7z", Size: size, Status: download.FileInObjectStore, StorageKey: &key})
	f := linkFixture{repo: repo, challenge: &downloadtest.Challenge{Verdict: download.Verdict{Success: true}}, authorizer: &downloadtest.Authorizer{}, sealer: &downloadtest.Sealer{}, file: file}
	f.links = download.NewLinkService(repo, &txtest.Immediate{}, f.challenge, f.authorizer, f.sealer, download.LinkOptions{
		Mode:           mode,
		CDNHost:        "https://cdn.example.com",
		WorkerHost:     "https://dl.example.com/",
		MaxConns:       0,
		BaseExpiresIn:  1800 * time.Second,
		EstimatedSpeed: mib,
		MaxExpiresIn:   86400 * time.Second,
	}, func() time.Time { return now })
	return f
}

func TestExpiresInGrowsWithSizeAndIsCapped(t *testing.T) {
	settings := download.LinkOptions{BaseExpiresIn: 1800 * time.Second, EstimatedSpeed: mib, MaxExpiresIn: 86400 * time.Second}
	cases := map[int64]int64{
		25 << 30:  1800 + 25*1024,
		2 << 30:   1800 + 2*1024,
		200 << 30: 86400,
		1:         1801,
		0:         1800,
	}
	for size, want := range cases {
		if got := settings.ExpiresIn(size); got != want {
			t.Fatalf("size %d: got %d want %d", size, got, want)
		}
	}
	zeroSpeed := download.LinkOptions{BaseExpiresIn: time.Hour, MaxExpiresIn: 24 * time.Hour}
	if got := zeroSpeed.ExpiresIn(10); got != 3610 {
		t.Fatalf("speed is clamped to at least one byte per second: %d", got)
	}
}

func TestIssueRequiresAValidToken(t *testing.T) {
	ctx := context.Background()
	f := newLinkFixture(download.ModeDirect, mib)
	_, err := f.links.Issue(ctx, f.file.ID, "")
	expectCode(t, err, download.ErrTokenRequired)
	f.challenge.Verdict = download.Verdict{ErrorCodes: []string{"timeout-or-duplicate", "invalid-input-response"}}
	_, err = f.links.Issue(ctx, f.file.ID, "token")
	expectCode(t, err, download.ErrInvalidToken)
	if appErr, _ := apperror.From(err); appErr.Args()["errorCodes"] != "timeout-or-duplicate,invalid-input-response" {
		t.Fatalf("error codes are interpolated: %v", appErr.Args())
	}
	f.challenge.Verdict = download.Verdict{Success: true}
	_, err = f.links.Issue(ctx, 999, "token")
	expectCode(t, err, download.ErrFileNotFound)
}

func TestIssueRejectsFilesThatAreNotInStorage(t *testing.T) {
	ctx := context.Background()
	f := newLinkFixture(download.ModeDirect, mib)
	pending := f.repo.SeedFile(download.File{ResourceID: f.file.ResourceID, Status: download.FileOnServer})
	_, err := f.links.Issue(ctx, pending.ID, "token")
	expectCode(t, err, download.ErrFileNotFound)
	removed := f.repo.SeedResource(download.Resource{GameID: 10, Status: download.ResourceRemoved})
	key := "k"
	hidden := f.repo.SeedFile(download.File{ResourceID: removed.ID, Status: download.FileInObjectStore, StorageKey: &key})
	_, err = f.links.Issue(ctx, hidden.ID, "token")
	expectCode(t, err, download.ErrFileNotFound)
	if f.repo.GameDownloads[10] != 0 {
		t.Fatal("refused links are not counted")
	}
}

func TestIssueDirectLink(t *testing.T) {
	ctx := context.Background()
	f := newLinkFixture(download.ModeDirect, 2<<30)
	link, err := f.links.Issue(ctx, f.file.ID, "token")
	if err != nil {
		t.Fatal(err)
	}
	if link.ExpiresIn != 1800+2*1024 {
		t.Fatalf("expires in %d", link.ExpiresIn)
	}
	want := "https://cdn.example.com/games%2F10%2F1%2F%E3%82%B2%E3%83%BC%E3%83%A0%20%E4%BD%93%E9%A8%93%E7%89%88.7z?Authorization=dl-token"
	if link.URL != want {
		t.Fatalf("url\n got %s\nwant %s", link.URL, want)
	}
	if len(f.authorizer.Calls) != 1 || f.authorizer.Calls[0].ValidFor != time.Duration(link.ExpiresIn)*time.Second {
		t.Fatalf("direct links authorize for the computed lifetime: %+v", f.authorizer.Calls)
	}
	resource, _ := f.repo.GetResource(ctx, f.file.ResourceID)
	if resource.Downloads != 1 || f.repo.GameDownloads[10] != 1 || !resource.Updated.Equal(now.Add(-time.Hour)) {
		t.Fatalf("counters %+v %v", resource, f.repo.GameDownloads)
	}
}

func TestIssueWorkerLink(t *testing.T) {
	ctx := context.Background()
	f := newLinkFixture(download.ModeWorker, 2<<30)
	link, err := f.links.Issue(ctx, f.file.ID, "token")
	if err != nil {
		t.Fatal(err)
	}
	if len(f.sealer.Tickets) != 1 {
		t.Fatalf("tickets %+v", f.sealer.Tickets)
	}
	ticket := f.sealer.Tickets[0]
	if ticket.Version != 3 || ticket.FileID != f.file.ID || ticket.FileName != f.file.Name || ticket.GameID != 10 || ticket.MaxConns != 1 {
		t.Fatalf("ticket %+v", ticket)
	}
	if ticket.Expires != now.Unix()+1800+2*1024 || ticket.HardExpires != now.Unix()+86400 || ticket.HardExpires-ticket.Expires != 86400-link.ExpiresIn {
		t.Fatalf("ticket deadlines %+v", ticket)
	}
	if ticket.Bucket != "bucket" || ticket.Key != *f.file.StorageKey || ticket.Token != "dl-token" || ticket.DownloadURL != "https://f005.backblazeb2.com" {
		t.Fatalf("ticket origin %+v", ticket)
	}
	if f.authorizer.Calls[0].ValidFor != 86400*time.Second {
		t.Fatalf("worker links authorize for the hard cap: %+v", f.authorizer.Calls)
	}
	prefix := "https://dl.example.com/dl/1/" + ticket.SessionID + "?ticket="
	if !strings.HasPrefix(link.URL, prefix) || !strings.HasSuffix(link.URL, "sealed.ticket%2B%2F%3D") {
		t.Fatalf("worker url %s", link.URL)
	}
}

func TestEncodeURIComponentMatchesJavaScript(t *testing.T) {
	cases := map[string]string{
		"a b/c?d=e&f":    "a%20b%2Fc%3Fd%3De%26f",
		"!'()*-._~":      "!'()*-._~",
		"$+,:;@#":        "%24%2B%2C%3A%3B%40%23",
		"ゲーム":            "%E3%82%B2%E3%83%BC%E3%83%A0",
		"folder/a b.zip": "folder%2Fa%20b.zip",
	}
	for in, want := range cases {
		if got := download.EncodeURIComponent(in); got != want {
			t.Fatalf("%q: got %s want %s", in, got, want)
		}
	}
}
