package animetrace_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/animetrace"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

var webp = []byte("RIFF\x24\x00\x00\x00WEBPVP8 picture")

type pacer struct {
	mu    sync.Mutex
	wait  time.Duration
	full  bool
	err   error
	paces []ratelimit.Pace
}

func (p *pacer) Reserve(_ context.Context, pace ratelimit.Pace) (time.Duration, bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.paces = append(p.paces, pace)
	return p.wait, !p.full, p.err
}

type upload struct {
	contentType string
	filename    string
	data        []byte
	fields      []string
}

func serve(t *testing.T, status int, reply string) (*animetrace.Client, *pacer, *[]upload) {
	t.Helper()
	var uploads []upload
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/search" {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		reader, err := r.MultipartReader()
		if err != nil {
			t.Errorf("multipart: %v", err)
			return
		}
		got := upload{}
		for {
			part, err := reader.NextPart()
			if err != nil {
				break
			}
			got.fields = append(got.fields, part.FormName())
			if part.FormName() == "file" {
				got.contentType, got.filename = part.Header.Get("Content-Type"), part.FileName()
				got.data, _ = io.ReadAll(part)
			}
		}
		uploads = append(uploads, got)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(reply))
	}))
	t.Cleanup(server.Close)
	settings := settingtest.Set(settingtest.Source{}, animetrace.Interval, 15*time.Second)
	settingtest.Set(settings, animetrace.MaxWait, 20*time.Second)
	queue := &pacer{}
	client := animetrace.NewClient(animetrace.Options{HTTP: server.Client(), Pacer: queue, Settings: settings, Endpoint: server.URL + "/v1/search"})
	return client, queue, &uploads
}

func TestRecognizeReadsEverySightingFromTheAnswer(t *testing.T) {
	client, queue, uploads := serve(t, http.StatusOK, `{"code":0,"ai":false,"trace_id":"t-1","data":[
		{"box":[0.694,0.234,0.829,0.487],"box_id":"a","not_confident":false,"character":[{"work":" 千恋＊万花 ","character":"レナ・リヒテナウアー"},{"work":"other","character":"other"}]},
		{"box":[0.6,0.9,0.2,-0.1],"box_id":"b","not_confident":true,"character":[{"work":"","character":"有地将臣"}]},
		{"box":[0.1,0.1,0.2,0.2],"box_id":"c","not_confident":false,"character":[]}
	]}`)
	got, err := client.Recognize(context.Background(), webp)
	if err != nil {
		t.Fatal(err)
	}
	want := []search.Sighting{
		{Box: search.Box{Left: 0.694, Top: 0.234, Right: 0.829, Bottom: 0.487}, Name: "レナ・リヒテナウアー", Work: "千恋＊万花"},
		{Box: search.Box{Left: 0.2, Top: 0, Right: 0.6, Bottom: 0.9}, Name: "有地将臣", Unsure: true},
	}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("the best candidate of each box, with the box ordered and kept in the picture: %+v", got)
	}
	sent := (*uploads)[0]
	if len(sent.fields) != 1 || sent.contentType != "image/webp" || sent.filename != "picture.webp" || string(sent.data) != string(webp) {
		t.Fatalf("only the picture is sent, so the service picks its default model: %+v", sent)
	}
	if len(queue.paces) != 1 || queue.paces[0] != (ratelimit.Pace{Name: animetrace.Name, Interval: 15 * time.Second, MaxWait: 20 * time.Second}) {
		t.Fatalf("every call queues with the configured pace: %+v", queue.paces)
	}
	if source := client.Source(); source.Name != "AnimeTrace" || source.URL != "https://www.animetrace.com/" {
		t.Fatalf("the source credits AnimeTrace: %+v", source)
	}
}

func TestRecognizeTranslatesRefusals(t *testing.T) {
	cases := []struct {
		name   string
		status int
		reply  string
		want   error
	}{
		{"too many requests", http.StatusTooManyRequests, `{"code":17737,"zh_message":"请求过于频繁，请稍后再试","detail":"Too Many Requests"}`, search.ErrImageBusy},
		{"congested", http.StatusOK, `{"code":17731,"trace_id":"t-2"}`, search.ErrImageBusy},
		{"usage limit", http.StatusOK, `{"code":17728}`, search.ErrImageBusy},
		{"unsupported format", http.StatusOK, `{"code":17705}`, search.ErrImageUnsupported},
		{"recognition failed", http.StatusOK, `{"code":17706}`, search.ErrImageFailed},
		{"entity too large page", http.StatusRequestEntityTooLarge, `<html><body>413 Request Entity Too Large</body></html>`, search.ErrImageFailed},
		{"gateway error", http.StatusBadGateway, `<html>bad gateway</html>`, search.ErrImageFailed},
		{"malformed answer", http.StatusOK, `{"code":`, search.ErrImageFailed},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			client, _, _ := serve(t, c.status, c.reply)
			if _, err := client.Recognize(context.Background(), webp); !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
		})
	}
}

func TestRecognizeWaitsForItsTurn(t *testing.T) {
	client, queue, uploads := serve(t, http.StatusOK, `{"code":0,"data":[]}`)
	queue.full = true
	if _, err := client.Recognize(context.Background(), webp); !errors.Is(err, search.ErrImageBusy) || len(*uploads) != 0 {
		t.Fatalf("a full queue turns the call away before it reaches AnimeTrace: %v %d", err, len(*uploads))
	}

	queue.full, queue.wait = false, 40*time.Millisecond
	started := time.Now()
	if got, err := client.Recognize(context.Background(), webp); err != nil || len(got) != 0 || time.Since(started) < 40*time.Millisecond {
		t.Fatalf("the call goes when its turn comes: %+v %v %s", got, err, time.Since(started))
	}

	queue.wait = time.Hour
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if _, err := client.Recognize(ctx, webp); !errors.Is(err, context.DeadlineExceeded) || len(*uploads) != 1 {
		t.Fatalf("a caller that gives up leaves the queue: %v %d", err, len(*uploads))
	}

	queue.wait, queue.err = 0, errors.New("redis down")
	if _, err := client.Recognize(context.Background(), webp); !errors.Is(err, search.ErrImageFailed) {
		t.Fatalf("a broken queue fails the call: %v", err)
	}
}

func TestRecognizeGivesUpOnASlowService(t *testing.T) {
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	defer server.Close()
	defer close(release)
	httpClient := server.Client()
	httpClient.Timeout = 30 * time.Millisecond
	client := animetrace.NewClient(animetrace.Options{HTTP: httpClient, Pacer: &pacer{}, Settings: settingtest.Source{}, Endpoint: server.URL + "/v1/search"})
	if _, err := client.Recognize(context.Background(), webp); !errors.Is(err, search.ErrImageFailed) {
		t.Fatalf("a timeout is a failed recognition: %v", err)
	}
}
