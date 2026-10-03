package messagehttp_test

import (
	"bufio"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/message/messagetest"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/realtime"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/messagehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var (
	receiver = actor.Actor{UserID: 7, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	sender   = actor.Actor{UserID: 8, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
)

func ptr[T any](v T) *T {
	return &v
}

func setup(t *testing.T, hub *realtime.Hub, notifier message.Notifier) (*apitest.Server, *message.Service) {
	t.Helper()
	server := apitest.New(t)
	repo := messagetest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.AddUser(user.Summary{ID: 7, Name: "receiver"})
	expires := apitest.Now.Add(time.Hour)
	repo.AddUser(user.Summary{ID: 8, Name: "sender", SponsorExpiresAt: &expires})
	if notifier == nil {
		notifier = &messagetest.RecordingNotifier{}
	}
	service := message.NewService(repo, notifier, gametest.NewCards(game.Card{ID: 3, TitleJP: "g"}), &txtest.Immediate{}, func() time.Time { return apitest.Now })
	messagehttp.NewHandler(service, hub, server.Builder).Register(server.API)
	return server, service
}

func TestListAndDetail(t *testing.T) {
	server, service := setup(t, nil, nil)
	ctx := context.Background()
	for i := range 3 {
		err := service.Send(ctx, message.NewMessage{Type: message.TypeCommentReply, Tone: message.ToneInfo, Title: "Messages.Reply", Content: "body", GameID: ptr(3), SenderID: ptr(8), ReceiverID: 7, Meta: []byte(`{"file_id":` + string(rune('1'+i)) + `}`)})
		if err != nil {
			t.Fatal(err)
		}
	}

	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/list"}), http.StatusUnauthorized, 200101)
	list := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/list?page=2&pageSize=2&unread=true&type=COMMENT_REPLY", As: &receiver})
	server.Expect(list, http.StatusOK, 0)
	want := `{"items":[{"id":1,"type":"COMMENT_REPLY","tone":"INFO","title":"Messages.Reply","receiver":{"id":7,"name":"receiver","avatar":null,"is_sponsor":false},"sender":{"id":8,"name":"sender","avatar":null,"is_sponsor":true},"read":false,"read_at":null,"created":"2026-10-03T01:02:03Z","updated":"2026-10-03T01:02:03Z"}],"meta":{"totalItems":3,"itemCount":1,"itemsPerPage":2,"totalPages":2,"currentPage":2}}`
	if string(list.Data) != want {
		t.Fatalf("unexpected list\n got %s\nwant %s", list.Data, want)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/list?type=OTHER", As: &receiver}), http.StatusUnprocessableEntity, 100101)

	unread := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/unread", As: &receiver})
	server.Expect(unread, http.StatusOK, 0)
	if string(unread.Data) != "3" {
		t.Fatalf("unread count %s", unread.Data)
	}

	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/1", As: &sender}), http.StatusForbidden, 530102)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/99", As: &receiver}), http.StatusNotFound, 530101)
	detail := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/1", As: &receiver})
	server.Expect(detail, http.StatusOK, 0)
	var body map[string]any
	detail.Decode(t, &body)
	if body["content"] != "body" || body["meta"].(map[string]any)["file_id"].(float64) != 1 || body["game"].(map[string]any)["title_jp"] != "g" || body["comment"] != nil {
		t.Fatalf("unexpected detail %s", detail.Data)
	}
	if count := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/unread", As: &receiver}); string(count.Data) != "2" {
		t.Fatalf("opening must mark the message read: %s", count.Data)
	}
}

func TestReadStateMutations(t *testing.T) {
	server, service := setup(t, nil, nil)
	ctx := context.Background()
	for range 2 {
		if err := service.Send(ctx, message.NewMessage{Type: message.TypeSystem, Title: "t", Content: "c", ReceiverID: 7}); err != nil {
			t.Fatal(err)
		}
	}
	read := server.Do(apitest.Request{Method: http.MethodPost, Path: "/message/1/read", As: &receiver})
	server.Expect(read, http.StatusCreated, 0)
	if read.HasData {
		t.Fatal("void endpoints omit data")
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/message/2/read", As: &sender}), http.StatusNotFound, 530101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/message/all/read", As: &receiver}), http.StatusCreated, 0)
	if count := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/unread", As: &receiver}); string(count.Data) != "0" {
		t.Fatalf("all read: %s", count.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/message/all/unread", As: &receiver}), http.StatusCreated, 0)
	if count := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/unread", As: &receiver}); string(count.Data) != "2" {
		t.Fatalf("all unread: %s", count.Data)
	}
}

func TestStreamDeliversUnreadAndNewMessages(t *testing.T) {
	client := redistest.New(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := realtime.NewHub(client, logger)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- hub.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		<-done
	})
	select {
	case <-hub.Ready():
	case <-time.After(5 * time.Second):
		t.Fatal("realtime hub did not subscribe")
	}
	server, service := setup(t, hub, hubNotifier{hub: hub})
	httpServer := httptest.NewServer(server.API.Handler())
	t.Cleanup(httpServer.Close)

	httpClient := httpServer.Client()
	unauthorized, err := httpClient.Get(httpServer.URL + "/message/stream")
	if err != nil {
		t.Fatal(err)
	}
	_ = unauthorized.Body.Close()
	if unauthorized.StatusCode != http.StatusUnauthorized {
		t.Fatalf("stream requires login: %d", unauthorized.StatusCode)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, httpServer.URL+"/message/stream", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+apitest.Token(receiver))
	resp, err := httpClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatalf("unexpected content type %q", resp.Header.Get("Content-Type"))
	}
	lines := make(chan string, 64)
	go func() {
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			lines <- scanner.Text()
		}
		close(lines)
	}()
	expect := func(want string) {
		t.Helper()
		timeout := time.After(5 * time.Second)
		for {
			select {
			case line, ok := <-lines:
				if !ok {
					t.Fatalf("stream closed before %q", want)
				}
				if strings.Contains(line, want) {
					return
				}
			case <-timeout:
				t.Fatalf("did not receive %q", want)
			}
		}
	}
	expect(`data: {"unread":0}`)
	if err := service.Send(context.Background(), message.NewMessage{Type: message.TypeSystem, Title: "hello", Content: "c", ReceiverID: 7}); err != nil {
		t.Fatal(err)
	}
	expect("event: message:new")
	expect(`"title":"hello"`)
}

type hubNotifier struct {
	hub *realtime.Hub
}

func (n hubNotifier) NewMessage(ctx context.Context, receiverID int, notice message.Notice) {
	_ = n.hub.Publish(ctx, receiverID, "message:new", notice)
}

func (n hubNotifier) Unread(ctx context.Context, receiverID int, count int) {
	_ = n.hub.Publish(ctx, receiverID, "message:unread", map[string]int{"unread": count})
}
