package searchhttp_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/search/searchtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/searchhttp"
)

type imageEnv struct {
	server     *apitest.Server
	recognizer *searchtest.Recognizer
	pictures   *searchtest.Pictures
}

func setupImages(t *testing.T) imageEnv {
	t.Helper()
	server := apitest.New(t)
	games := gametest.NewCatalog(gametest.Entry{HasResources: true, Detail: game.Detail{ID: 1, TitleJP: "千恋＊万花", Covers: []game.Cover{{URL: "c.webp"}}}})
	source := searchtest.NewCatalog()
	source.Hits[catalog.EntityGame] = hits("g1")
	source.Links[catalog.EntityGame] = map[string]int{"g1": 1}
	source.Hits[catalog.EntityCharacter] = hits("c92")
	source.Links[catalog.EntityCharacter] = map[string]int{"c92": 92}
	zh := "蕾娜·莉希特娜瓦"
	finder := search.NewService(search.Deps{
		Source:      catalog.SourceHikarinagi,
		Catalog:     source,
		Games:       games,
		Cards:       game.NewCardService(games, gametest.Masker{}),
		Preferences: gametest.Preferences{},
		Characters:  searchtest.Characters{92: {ID: 92, NameJP: "レナ・リヒテナウアー", NameZH: &zh, Game: &character.GameRef{ID: 1, TitleJP: "千恋＊万花"}}},
		Cache:       gametest.NewCache(),
	})
	e := imageEnv{
		server: server,
		recognizer: &searchtest.Recognizer{Sightings: []search.Sighting{
			{Box: search.Box{Left: 0.69, Top: 0.23, Right: 0.83, Bottom: 0.49}, Name: "レナ・リヒテナウアー", Work: "千恋＊万花"},
		}},
		pictures: &searchtest.Pictures{},
	}
	images := search.NewImageService(search.ImageDeps{Finder: finder, Recognizer: e.recognizer, Pictures: e.pictures, Cache: gametest.NewCache()})
	searchhttp.NewImageHandler(images, server.Builder).Register(server.API)
	return e
}

func hits(ids ...string) []catalog.SearchHit {
	out := make([]catalog.SearchHit, len(ids))
	for i, id := range ids {
		out[i] = catalog.SearchHit{ExternalID: id, Title: id}
	}
	return out
}

func picture(t *testing.T, data []byte) apitest.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if data != nil {
		header := textproto.MIMEHeader{}
		header.Set("Content-Disposition", `form-data; name="file"; filename="picture.png"`)
		header.Set("Content-Type", "image/png")
		part, err := writer.CreatePart(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return apitest.Request{Method: http.MethodPost, Path: "/search/image", Body: body.String(), Header: map[string]string{"Content-Type": writer.FormDataContentType()}}
}

func TestImageSearchAnswersWithTheLibrarysEntries(t *testing.T) {
	e := setupImages(t)
	resp := e.server.Do(picture(t, []byte("png")))
	e.server.Expect(resp, http.StatusOK, 0)
	var got struct {
		Source struct {
			Name string `json:"name"`
			URL  string `json:"url"`
		} `json:"source"`
		Games []struct {
			ID      int    `json:"id"`
			TitleJP string `json:"title_jp"`
		} `json:"games"`
		Unlisted   []string          `json:"unlisted_works"`
		Characters []json.RawMessage `json:"characters"`
	}
	if err := json.Unmarshal(resp.Data, &got); err != nil {
		t.Fatal(err)
	}
	if got.Source.Name != "Recognizer" || got.Source.URL != "https://recognizer.test/" || len(got.Games) != 1 || got.Games[0].ID != 1 || got.Unlisted == nil || len(got.Unlisted) != 0 {
		t.Fatalf("source, games and works outside the library: %s", resp.Data)
	}
	want := `{"box":{"left":0.69,"top":0.23,"right":0.83,"bottom":0.49},"name":"レナ・リヒテナウアー","work":"千恋＊万花","unsure":false,"game_id":1,"character":{"id":92,"image":null,"image_thumb_hash":null,"name_jp":"レナ・リヒテナウアー","name_zh":"蕾娜·莉希特娜瓦","name_en":null}}`
	if len(got.Characters) != 1 || string(got.Characters[0]) != want {
		t.Fatalf("characters: %s", resp.Data)
	}
	if len(e.recognizer.Images) != 1 || string(e.recognizer.Images[0]) != "shrunk:png" {
		t.Fatalf("the uploaded picture is recognized: %q", e.recognizer.Images)
	}
}

func TestImageSearchNamesTheServiceToCredit(t *testing.T) {
	e := setupImages(t)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/search/image/source"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"name":"Recognizer","url":"https://recognizer.test/"}` || len(e.recognizer.Images) != 0 {
		t.Fatalf("the source is named without recognizing anything: %s", resp.Data)
	}
}

func TestImageSearchRefusesWhatItCannotRecognize(t *testing.T) {
	e := setupImages(t)
	e.server.Expect(e.server.Do(picture(t, nil)), http.StatusBadRequest, 700101)

	e.pictures.Err = errors.New("not an image")
	e.server.Expect(e.server.Do(picture(t, []byte("text"))), http.StatusUnsupportedMediaType, 700103)

	e.pictures.Err = nil
	e.recognizer.Err = search.ErrImageBusy
	e.server.Expect(e.server.Do(picture(t, []byte("busy"))), http.StatusServiceUnavailable, 700104)

	e.recognizer.Err = search.ErrImageFailed.Wrap(errors.New("code 17706"))
	e.server.Expect(e.server.Do(picture(t, []byte("failed"))), http.StatusBadGateway, 700105)
}
