package messagehttp_test

import (
	"bufio"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
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
		err := service.Send(ctx, message.NewMessage{Type: message.TypeCommentReply, Tone: message.ToneInfo, Title: "Messages.Reply", Content: "body", GameID: ptr(3), SenderID: ptr(8), ReceiverID: 7, Meta: message.Meta{"file_id": i + 1}})
		if err != nil {
			t.Fatal(err)
		}
	}

	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/list"}), http.StatusUnauthorized, 200101)
	list := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/list?page=2&pageSize=2&unread=true&type=COMMENT_REPLY", As: &receiver})
	server.Expect(list, http.StatusOK, 0)
	want := `{"items":[{"id":1,"type":"COMMENT_REPLY","tone":"INFO","title":"Messages.Reply","excerpt":"body","receiver":{"id":7,"name":"receiver","avatar":null,"is_sponsor":false},"sender":{"id":8,"name":"sender","avatar":null,"is_sponsor":true},"read":false,"read_at":null,"created":"2026-10-03T01:02:03.000Z","updated":"2026-10-03T01:02:03.000Z"}],"meta":{"totalItems":3,"itemCount":1,"itemsPerPage":2,"totalPages":2,"currentPage":2}}`
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
	expect(`"id":1`)
}

type hubNotifier struct {
	hub *realtime.Hub
}

type noticeEvent struct {
	ID int `json:"id"`
}

func (n hubNotifier) NewMessage(ctx context.Context, receiverID int, notice message.Notice) {
	_ = n.hub.Publish(ctx, receiverID, "message:new", noticeEvent{ID: notice.ID})
}

func (hubNotifier) UnreadUnknown(context.Context, int, error) {}

func (n hubNotifier) Unread(ctx context.Context, receiverID int, count int) {
	_ = n.hub.Publish(ctx, receiverID, "message:unread", map[string]int{"unread": count})
}

func TestMessagesAreWrittenInTheCallersLanguage(t *testing.T) {
	server, service := setup(t, nil, nil)
	ctx := context.Background()
	deadline := time.Date(2026, 10, 9, 4, 30, 0, 0, time.UTC)
	linkText := "Messages.System.Report.NewReport.LinkText"
	for _, in := range []message.NewMessage{
		{Title: "Messages.System.Report.NewReport.Title", Content: "Messages.System.Report.NewReport.Content", LinkText: &linkText, LinkURL: ptr("/admin/reports?id=5"), Meta: message.Meta{"reporter_name": "kotori", "reported_user_name": "mikan", "reason": "BROKEN_LINK", "malicious_level": "LOW"}},
		{Title: "Messages.System.File.Upload.FileVirusReviewPendingTitle", Content: "Messages.System.File.Upload.FileVirusReviewPendingContent", Meta: message.Meta{"file_name": "a.7z", "malware_case_id": 12, "review_deadline": deadline, "detected_viruses": "Eicar"}},
		{Title: "Messages.System.File.Upload.FileVirusFalsePositiveReleasedTitle", Content: "Messages.System.File.Upload.FileVirusFalsePositiveReleasedContent", Meta: message.Meta{"file_name": "a.7z", "malware_case_id": 12, "review_note": nil}},
		{Title: "Messages.System.Report.Penalty.Title", Content: "Messages.System.Report.Penalty.Content", Meta: message.Meta{"reason": "MALWARE", "malicious_level": "HIGH", "ban_days": 7, "upload_tier_demoted": true, "process_note": "已核实"}},
		{Title: "Messages.System.File.Reupload.FileReuploadedTitle", Content: "Messages.System.File.Reupload.FileReuploadedContent", Meta: message.Meta{"file_name": "a.7z", "game_title_jp": "サクラノ詩", "game_title_zh": "", "game_title_en": "Sakura no Uta"}},
		{Title: "Messages.System.File.Upload.FileUploadFailedTitle", Content: "Messages.System.File.Upload.FileCheckFailedContent", Meta: message.Meta{"file_name": "a.part1.rar", "reason": "INCOMPLETE_SET", "missing_volumes": []string{"a.part2.rar", "a.part3.rar"}}},
		{Title: "Messages.System.File.Upload.FileCheckStalledAdminTitle", Content: "Messages.System.File.Upload.FileCheckStalledAdminContent", Meta: message.Meta{"file_name": "a.7z", "uploader_name": "kotori", "failures": 6, "last_error": "extract executables: exit status 2", "review_deadline": deadline}},
		{Title: "Messages.System.File.Upload.FileUploadFailedTitle", Content: "Messages.System.File.Upload.FileCheckFailedContent", Meta: message.Meta{"file_name": "a.7z", "reason": "ABANDONED"}},
		{Title: "写好的标题", Content: "写好的正文"},
	} {
		in.Type, in.Tone, in.ReceiverID = message.TypeSystem, message.ToneInfo, 7
		if err := service.Send(ctx, in); err != nil {
			t.Fatal(err)
		}
	}
	type written struct {
		Title    string  `json:"title"`
		Content  string  `json:"content"`
		LinkText *string `json:"link_text"`
	}
	open := func(id int, lang string) written {
		t.Helper()
		resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/" + strconv.Itoa(id) + "?lang=" + lang, As: &receiver})
		server.Expect(resp, http.StatusOK, 0)
		var out written
		resp.Decode(t, &out)
		return out
	}
	for name, tc := range map[string]struct {
		id      int
		lang    string
		title   string
		content string
	}{
		"codes become words":         {1, "zh", "有新的资源举报", "kotori 举报了 mikan 上传的资源。举报原因：链接失效；严重程度：低。"},
		"another language":           {1, "en", "New resource report", "kotori reported a resource uploaded by mikan. Reason: Broken Link; severity: Low."},
		"a time in the site's zone":  {2, "zh", "文件等待人工复核", "你上传的文件 a.7z 在病毒扫描中被标记（Eicar），已转入人工复核（编号 #12），将在 2026-10-09 12:30 前完成"},
		"an absent note":             {3, "zh", "文件已通过复核", "你的文件 a.7z（编号 #12）经复核判定为误报，已恢复正常。"},
		"optional sentences":         {4, "zh", "资源违规处理通知", "你上传的资源经核实违规。违规类型：恶意软件；严重程度：高。你的上传档位已被下调。你的账号已被封禁 7 天。处理说明：已核实"},
		"the game title of the page": {5, "zh", "你收藏的游戏有文件更新", "你收藏的游戏《サクラノ詩》的文件 a.7z 已更新。"},
		"the title in English":       {5, "en", "A file of a game you favorited was updated", "The file a.7z of Sakura no Uta, a game you favorited, was updated."},
		"a list of values":           {6, "zh", "文件未通过检查", "你上传的文件 a.part1.rar 未通过检查：分卷不完整。缺少的分卷：a.part2.rar, a.part3.rar。请确认文件后重新上传。"},
		"an error as it was written": {7, "zh", "有文件的检查已暂停", "kotori 上传的文件 a.7z 连续 6 次检查失败，已暂停重试。最近一次的错误：extract executables: exit status 2。请在 2026-10-09 12:30 前处理，逾期文件将被移除。"},
		"a check nobody finished":    {8, "zh", "文件未通过检查", "你上传的文件 a.7z 未通过检查：系统未能完成对文件的检查。请确认文件后重新上传。"},
		"text that is already text":  {9, "ja", "写好的标题", "写好的正文"},
	} {
		got := open(tc.id, tc.lang)
		if got.Title != tc.title || got.Content != tc.content {
			t.Fatalf("%s:\n got %q / %q\nwant %q / %q", name, got.Title, got.Content, tc.title, tc.content)
		}
	}
	if got := open(1, "ja"); got.LinkText == nil || *got.LinkText != "対応する" {
		t.Fatalf("link text follows the language: %+v", got.LinkText)
	}

	list := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/list?pageSize=10&lang=zh", As: &receiver})
	var page struct {
		Items []struct {
			ID      int    `json:"id"`
			Title   string `json:"title"`
			Excerpt string `json:"excerpt"`
		} `json:"items"`
	}
	list.Decode(t, &page)
	if len(page.Items) != 9 || page.Items[0].Title != "写好的标题" || page.Items[8].Title != "有新的资源举报" || page.Items[8].Excerpt != "kotori 举报了 mikan 上传的资源。举报原因：链接失效；严重程度：低。" {
		t.Fatalf("the list is written the same way: %+v", page.Items)
	}
}

func TestExcerptIsOneShortLine(t *testing.T) {
	server, service := setup(t, nil, nil)
	long := strings.Repeat("汐", 130)
	if err := service.Send(context.Background(), message.NewMessage{Type: message.TypeSystem, Tone: message.ToneInfo, Title: "t", Content: "第一行\n第二行 " + long, ReceiverID: 7}); err != nil {
		t.Fatal(err)
	}
	list := server.Do(apitest.Request{Method: http.MethodGet, Path: "/message/list", As: &receiver})
	var page struct {
		Items []struct {
			Excerpt string `json:"excerpt"`
		} `json:"items"`
	}
	list.Decode(t, &page)
	want := "第一行 第二行 " + strings.Repeat("汐", 112) + "…"
	if len(page.Items) != 1 || page.Items[0].Excerpt != want {
		t.Fatalf("got %q", page.Items[0].Excerpt)
	}
}
