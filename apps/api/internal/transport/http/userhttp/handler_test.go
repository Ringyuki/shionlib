package userhttp_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth/authtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/mediahttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user/usertest"
)

type processor struct{}

func (processor) ToWebP(_ context.Context, data []byte, _ media.Bounds) (media.Encoded, error) {
	return media.Encoded{Data: data, ContentType: "image/webp", Extension: ".webp"}, nil
}

type bucket struct {
	keys []string
}

func (b *bucket) PutBytes(_ context.Context, key string, _ []byte, _ string, _ map[string]string) error {
	b.keys = append(b.keys, key)
	return nil
}

type editStore struct {
	records []user.EditRecord
	viewer  actor.Actor
}

func (s *editStore) ListByActor(_ context.Context, _ int, viewer actor.Actor, _ user.Page) ([]user.EditRecord, int, error) {
	s.viewer = viewer
	return s.records, len(s.records), nil
}

type env struct {
	server   *apitest.Server
	users    *usertest.MemoryRepository
	repo     *authtest.MemoryRepository
	store    *authtest.MemoryStore
	mailer   *authtest.Mailer
	families *authtest.Blocklist
	codes    *auth.Codes
	sessions *auth.Sessions
	bucket   *bucket
	edits    *editStore
}

func setup(t *testing.T) *env {
	t.Helper()
	now := func() time.Time { return apitest.Now }
	e := &env{
		server:   apitest.New(t),
		users:    usertest.NewMemoryRepository(now),
		repo:     authtest.NewMemoryRepository(now),
		store:    authtest.NewMemoryStore(now),
		mailer:   &authtest.Mailer{},
		families: authtest.NewBlocklist(),
		bucket:   &bucket{},
		edits:    &editStore{},
	}
	tx := &txtest.Immediate{}
	e.sessions = auth.NewSessions(e.repo, e.users, authtest.Codec{}, authtest.Hasher{}, e.families, e.store, tx, now, auth.SessionPolicy{Version: "slrt1", AccessTTL: time.Hour, ShortWindow: time.Hour, LongWindow: time.Hour})
	e.codes = auth.NewCodes(e.store, e.mailer, now)
	images := media.NewService(processor{}, e.bucket, func() string { return "uuid" })
	service := user.NewService(e.users, tx, e.sessions, e.codes, authtest.Hasher{}, images, now, user.Policy{AllowRegister: true})
	userhttp.NewHandler(service, user.NewEditHistory(e.edits), e.server.Builder).Register(e.server.API)
	mediahttp.NewHandler(images, e.server.Builder).Register(e.server.API)
	return e
}

func as(u user.User) *actor.Actor {
	return &actor.Actor{UserID: u.ID, Role: u.Role, ContentLimit: u.ContentLimit}
}

func (e *env) code(t *testing.T, email string) (string, string) {
	t.Helper()
	id, err := e.codes.Request(context.Background(), email, 0)
	if err != nil {
		t.Fatal(err)
	}
	return id, e.mailer.Last().Body
}

func TestRegister(t *testing.T) {
	e := setup(t)
	e.users.Seed(user.User{Name: "taken", Email: "taken@example.test"})
	id, code := e.code(t, "new@example.test")
	body := map[string]any{"name": "newbie", "email": "new@example.test", "password": "Secret123", "code": code, "uuid": id}

	weak := map[string]any{"name": "newbie", "email": "new@example.test", "password": "alllowercase1", "code": code, "uuid": id}
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user", Body: weak})
	e.server.Expect(resp, http.StatusUnprocessableEntity, 100101)
	if !strings.Contains(string(resp.Data), `"field":"password"`) {
		t.Fatalf("password policy must report the password field: %s", resp.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user", Body: map[string]any{"name": "x", "email": "new@example.test", "password": "Secret123", "code": code, "uuid": id}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user", Body: map[string]any{"name": "taken", "email": "new@example.test", "password": "Secret123", "code": code, "uuid": id}}), http.StatusConflict, 300103)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user", Body: map[string]any{"name": "newbie", "email": "new@example.test", "password": "Secret123", "code": "WRONG1", "uuid": id}}), http.StatusUnauthorized, 200108)

	created := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user", Body: body, Header: map[string]string{"Accept-Language": "ja-JP"}})
	e.server.Expect(created, http.StatusCreated, 0)
	if string(created.Data) != `{"id":2,"name":"newbie","email":"new@example.test","role":1,"created":"2026-10-03T01:02:03Z"}` {
		t.Fatalf("unexpected registration %s", created.Data)
	}
	if got := e.users.User(2); got.Lang != user.LangJA || !e.users.HasDefaultFavorite(2) {
		t.Fatalf("unexpected stored user %+v", got)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user", Body: body}), http.StatusUnauthorized, 200107)
}

func TestMeProfileAndNameCheck(t *testing.T) {
	e := setup(t)
	sponsor := apitest.Now.Add(time.Hour)
	alice := e.users.Seed(user.User{Name: "alice", Email: "alice@example.test", SponsorExpiresAt: &sponsor})
	e.users.SetStats(alice.ID, user.Stats{Resources: 1, Comments: 2, FavoriteItems: 3, Edits: 4, Walkthroughs: 5})

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/me"}), http.StatusUnauthorized, 200101)
	me := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/me", As: as(alice)})
	e.server.Expect(me, http.StatusOK, 0)
	if string(me.Data) != `{"id":1,"name":"alice","email":"alice@example.test","avatar":null,"cover":null,"bio":null,"role":1,"lang":"en","content_limit":1,"only_games_with_resources":false,"sponsor_expires_at":"2026-10-03T02:02:03Z","is_sponsor":true}` {
		t.Fatalf("unexpected me %s", me.Data)
	}
	profile := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/1"})
	e.server.Expect(profile, http.StatusOK, 0)
	if string(profile.Data) != `{"id":1,"name":"alice","avatar":null,"role":1,"bio":null,"cover":null,"created":"2026-10-03T01:02:03Z","status":1,"sponsor_expires_at":"2026-10-03T02:02:03Z","is_sponsor":true,"resource_count":1,"comment_count":2,"favorite_count":3,"edit_count":4,"walkthrough_count":5}` {
		t.Fatalf("unexpected profile %s", profile.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/99"}), http.StatusNotFound, 300101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/abc"}), http.StatusUnprocessableEntity, 100101)
	check := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/check-name", Body: map[string]any{"name": "alice"}})
	e.server.Expect(check, http.StatusCreated, 0)
	if string(check.Data) != `{"exists":true}` {
		t.Fatalf("unexpected check %s", check.Data)
	}
}

func TestBanAndUnban(t *testing.T) {
	e := setup(t)
	admin := e.users.Seed(user.User{Name: "admin", Role: actor.RoleAdmin})
	member := e.users.Seed(user.User{Name: "member"})
	root := e.users.Seed(user.User{Name: "root", Role: actor.RoleSuperAdmin})
	path := "/user/" + strconv.Itoa(member.ID)

	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/ban", As: as(member), Body: map[string]any{"is_permanent": true}})
	e.server.Expect(resp, http.StatusForbidden, 403)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/ban", As: as(admin), Body: map[string]any{}}), http.StatusUnprocessableEntity, 300111)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/ban", As: as(admin), Body: map[string]any{"banned_duration_days": 1000}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/" + strconv.Itoa(root.ID) + "/ban", As: as(admin), Body: map[string]any{"is_permanent": true}}), http.StatusNotFound, 300101)
	banned := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/ban", As: as(admin), Body: map[string]any{"banned_duration_days": 3, "banned_reason": "spam", "banned_by": 999, "delete_user_comments": true}})
	e.server.Expect(banned, http.StatusCreated, 0)
	if banned.HasData || e.users.User(member.ID).Status != user.StatusBanned || !e.users.CommentsDeleted(member.ID) {
		t.Fatalf("ban side effects: %s", banned.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/ban", As: as(admin), Body: map[string]any{"is_permanent": true}}), http.StatusConflict, 300109)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/unban", As: as(admin)}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path + "/unban", As: as(admin)}), http.StatusConflict, 300110)
}

func TestProfileSettings(t *testing.T) {
	e := setup(t)
	hash := "hash:Old12345"
	alice := e.users.Seed(user.User{Name: "alice", Email: "alice@example.test", PasswordHash: &hash})
	e.users.Seed(user.User{Name: "bob"})
	who := as(alice)

	bio := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/bio", As: who, Body: map[string]any{"bio": ""}})
	e.server.Expect(bio, http.StatusCreated, 0)
	if string(bio.Data) != `{"bio":""}` {
		t.Fatalf("unexpected bio %s", bio.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/name", As: who, Body: map[string]any{"name": "bob"}}), http.StatusConflict, 300103)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/name", As: who, Body: map[string]any{"name": strings.Repeat("x", 21)}}), http.StatusUnprocessableEntity, 100101)
	if renamed := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/name", As: who, Body: map[string]any{"name": "carol"}}); string(renamed.Data) != `{"name":"carol"}` {
		t.Fatalf("unexpected rename %s", renamed.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/lang", As: who, Body: map[string]any{"lang": "fr"}}), http.StatusUnprocessableEntity, 300107)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/lang", As: who, Body: map[string]any{}}), http.StatusUnprocessableEntity, 300107)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/lang", As: who, Body: map[string]any{"lang": "zh"}}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/content-limit", As: who, Body: map[string]any{"content_limit": 4}}), http.StatusUnprocessableEntity, 300108)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/content-limit", As: who, Body: map[string]any{"content_limit": 3}}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/only-games-with-resources", As: who, Body: map[string]any{"only_games_with_resources": "yes"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/only-games-with-resources", As: who, Body: map[string]any{"only_games_with_resources": true}}), http.StatusCreated, 0)
	got := e.users.User(alice.ID)
	if got.Lang != user.LangZH || got.ContentLimit != actor.ContentLimitJustShow || !got.OnlyGamesWithResources || got.Name != "carol" {
		t.Fatalf("settings not stored %+v", got)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/password", As: who, Body: map[string]any{"password": "New12345", "old_password": "wrong"}}), http.StatusUnauthorized, 300106)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/password", As: who, Body: map[string]any{"password": "New12345", "old_password": "Old12345"}}), http.StatusCreated, 0)
	if *e.users.User(alice.ID).PasswordHash != "hash:New12345" {
		t.Fatal("password not changed")
	}
}

func TestEmailChange(t *testing.T) {
	e := setup(t)
	alice := e.users.Seed(user.User{Name: "alice", Email: "alice@example.test"})
	requested := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/email/request", As: as(alice)})
	e.server.Expect(requested, http.StatusCreated, 0)
	var current struct {
		UUID string `json:"uuid"`
	}
	requested.Decode(t, &current)
	currentCode := e.mailer.Last()
	if currentCode.To != "alice@example.test" || currentCode.TTL != 30*time.Minute {
		t.Fatalf("the code goes to the current address for 30 minutes: %+v", currentCode)
	}
	newID, newCode := e.code(t, "next@example.test")
	body := map[string]any{"email": "next@example.test", "currentUuid": current.UUID, "currentCode": currentCode.Body, "newUuid": newID, "newCode": "WRONG1"}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/email", As: as(alice), Body: body}), http.StatusUnauthorized, 200108)
	body["newCode"] = newCode
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/email", As: as(alice), Body: body}), http.StatusCreated, 0)
	if e.users.User(alice.ID).Email != "next@example.test" {
		t.Fatal("email not changed")
	}
}

func upload(t *testing.T, field, contentType string, size int) (string, string) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="`+field+`"; filename="image"`)
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write(bytes.Repeat([]byte{7}, size))
	_ = writer.Close()
	return body.String(), writer.FormDataContentType()
}

func TestImageUploads(t *testing.T) {
	e := setup(t)
	alice := e.users.Seed(user.User{Name: "alice"})
	admin := e.users.Seed(user.User{Name: "admin", Role: actor.RoleAdmin})

	body, contentType := upload(t, "avatar", "image/gif", 10)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/avatar", As: as(alice), Body: body, Header: map[string]string{"Content-Type": contentType}}), http.StatusUnsupportedMediaType, 490103)
	body, contentType = upload(t, "file", "image/png", 10)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/avatar", As: as(alice), Body: body, Header: map[string]string{"Content-Type": contentType}}), http.StatusBadRequest, 490102)
	body, contentType = upload(t, "avatar", "image/png", media.ProfileImageMaxBytes+128<<10)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/avatar", As: as(alice), Body: body, Header: map[string]string{"Content-Type": contentType}}), http.StatusRequestEntityTooLarge, 413)
	body, contentType = upload(t, "avatar", "image/png", media.ProfileImageMaxBytes+1)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/avatar", As: as(alice), Body: body, Header: map[string]string{"Content-Type": contentType}}), http.StatusRequestEntityTooLarge, 413)

	body, contentType = upload(t, "avatar", "image/jpeg", 10)
	avatar := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/avatar", As: as(alice), Body: body, Header: map[string]string{"Content-Type": contentType}})
	e.server.Expect(avatar, http.StatusCreated, 0)
	if string(avatar.Data) != `{"key":"user/1/avatar/uuid.webp"}` || *e.users.User(alice.ID).Avatar != "user/1/avatar/uuid.webp" {
		t.Fatalf("unexpected avatar %s", avatar.Data)
	}
	body, contentType = upload(t, "cover", "image/avif", 10)
	cover := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/info/cover", As: as(alice), Body: body, Header: map[string]string{"Content-Type": contentType}})
	if string(cover.Data) != `{"key":"user/1/cover/uuid.webp"}` {
		t.Fatalf("unexpected cover %s", cover.Data)
	}

	body, contentType = upload(t, "file", "image/webp", 10)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/uploads/small/ad/image", As: as(alice), Body: body, Header: map[string]string{"Content-Type": contentType}}), http.StatusForbidden, 403)
	ad := e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/uploads/small/ad/image", As: as(admin), Body: body, Header: map[string]string{"Content-Type": contentType}})
	e.server.Expect(ad, http.StatusOK, 0)
	if string(ad.Data) != `{"key":"ad/image/uuid.webp"}` {
		t.Fatalf("unexpected ad image %s", ad.Data)
	}
}

func TestEditRecords(t *testing.T) {
	e := setup(t)
	relation := "cover"
	name := "名前"
	e.edits.records = []user.EditRecord{
		{ID: 3, Entity: user.EditedGameEntity, TargetID: 10, Action: "UPDATE_SCALAR", FieldChanges: []string{"title_zh"}, Changes: json.RawMessage(`{"title_zh":"x"}`), RelationType: &relation, Created: apitest.Now, Updated: apitest.Now, Game: &user.EditedGame{ID: 10, TitleJP: "ゲーム", Covers: []user.EditedCover{{URL: "c.webp", Language: "jp", Dims: []int{1, 2}}}}},
		{ID: 2, Entity: user.EditedCharacterEntity, TargetID: 5, Action: "ADD_RELATION", FieldChanges: []string{}, Created: apitest.Now, Updated: apitest.Now, Character: &user.EditedCharacter{ID: 5, NameJP: "キャラ", NameZH: &name}},
		{ID: 1, Entity: user.EditedDeveloperEntity, TargetID: 6, Action: "SET_RELATION", FieldChanges: []string{}, Created: apitest.Now, Updated: apitest.Now},
	}
	viewer := &actor.Actor{UserID: 9, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/edit-records?page=1&pageSize=3", As: viewer})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` +
		`{"id":3,"entity":"game","target_id":10,"action":"UPDATE_SCALAR","field_changes":["title_zh"],"changes":{"title_zh":"x"},"relation_type":"cover","created":"2026-10-03T01:02:03Z","updated":"2026-10-03T01:02:03Z","entity_info":{"id":10,"title_jp":"ゲーム","title_zh":"","title_en":"","intro_jp":"","intro_zh":"","intro_en":"","covers":[{"url":"c.webp","language":"jp","dims":[1,2],"sexual":0,"violence":0}]}},` +
		`{"id":2,"entity":"character","target_id":5,"action":"ADD_RELATION","field_changes":[],"changes":null,"relation_type":null,"created":"2026-10-03T01:02:03Z","updated":"2026-10-03T01:02:03Z","entity_info":{"id":5,"name_jp":"キャラ","name_zh":"名前","name_en":null}},` +
		`{"id":1,"entity":"developer","target_id":6,"action":"SET_RELATION","field_changes":[],"changes":null,"relation_type":null,"created":"2026-10-03T01:02:03Z","updated":"2026-10-03T01:02:03Z","entity_info":null}` +
		`],"meta":{"totalItems":3,"itemCount":3,"itemsPerPage":3,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected edit records\n got %s\nwant %s", resp.Data, want)
	}
	if e.edits.viewer.ContentLimit != actor.ContentLimitJustShow {
		t.Fatal("the viewer must reach the store for content filtering")
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/edit-records?pageSize=51"}), http.StatusUnprocessableEntity, 100101)
}
