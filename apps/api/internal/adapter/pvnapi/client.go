package pvnapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

const maxResponseBytes = 8 << 20

type Client struct {
	http    *http.Client
	baseURL string
}

func NewClient(httpClient *http.Client, baseURL string) *Client {
	return &Client{http: httpClient, baseURL: strings.TrimSuffix(baseURL, "/")}
}

type sessionResponse struct {
	User struct {
		ID       int    `json:"id"`
		UserName string `json:"userName"`
	} `json:"user"`
	Token  string  `json:"token"`
	Expire float64 `json:"expire"`
}

type optionalID struct {
	value *string
}

func (o *optionalID) UnmarshalJSON(raw []byte) error {
	text := strings.TrimSpace(string(raw))
	switch {
	case text == "null":
		o.value = nil
		return nil
	case strings.HasPrefix(text, `"`):
		var value string
		if err := json.Unmarshal(raw, &value); err != nil {
			return err
		}
		o.value = &value
		return nil
	default:
		if _, err := strconv.ParseFloat(text, 64); err != nil {
			return fmt.Errorf("unexpected id %s", text)
		}
		o.value = &text
		return nil
	}
}

type galgameResponse struct {
	ID            int        `json:"id"`
	BgmID         optionalID `json:"bgmId"`
	VndbID        optionalID `json:"vndbId"`
	TotalPlayTime int        `json:"totalPlayTime"`
	PlayTime      []struct {
		DateTimeStamp float64 `json:"dateTimeStamp"`
		Minute        int     `json:"minute"`
	} `json:"playTime"`
	PlayType int `json:"playType"`
	MyRate   int `json:"myRate"`
}

type libraryResponse struct {
	PageCnt int               `json:"pageCnt"`
	Items   []galgameResponse `json:"items"`
}

type galgamePayload struct {
	BgmID                *string  `json:"bgmId"`
	VndbID               *string  `json:"vndbId"`
	Name                 string   `json:"name"`
	CnName               string   `json:"cnName"`
	Description          string   `json:"description"`
	Tags                 []string `json:"tags"`
	ReleaseDateTimeStamp *float64 `json:"releaseDateTimeStamp"`
	PlayType             int      `json:"playType"`
	ImageLoc             *string  `json:"imageLoc,omitempty"`
}

func (c *Client) Login(ctx context.Context, userName, password string) (potatovn.Session, error) {
	var session sessionResponse
	body := map[string]string{"userName": userName, "password": password}
	if err := c.call(ctx, http.MethodPost, "/user/session", nil, "", body, &session); err != nil {
		var status statusError
		if errors.As(err, &status) && status.code >= 400 && status.code < 500 {
			return potatovn.Session{}, potatovn.ErrBindingAuthFailed.Wrap(err)
		}
		return potatovn.Session{}, potatovn.ErrRequestFailed.Wrap(err)
	}
	return toSession(session)
}

func (c *Client) Refresh(ctx context.Context, token string) (potatovn.Session, error) {
	var session sessionResponse
	if err := c.call(ctx, http.MethodGet, "/user/session/refresh", nil, token, nil, &session); err != nil {
		return potatovn.Session{}, translate(err)
	}
	return toSession(session)
}

func (c *Client) Library(ctx context.Context, token string, pageIndex, pageSize int) (potatovn.LibraryPage, error) {
	query := url.Values{"timestamp": {"0"}, "pageSize": {strconv.Itoa(pageSize)}, "pageIndex": {strconv.Itoa(pageIndex)}}
	var library libraryResponse
	if err := c.call(ctx, http.MethodGet, "/galgame", query, token, nil, &library); err != nil {
		return potatovn.LibraryPage{}, translate(err)
	}
	page := potatovn.LibraryPage{PageCount: library.PageCnt, Items: make([]potatovn.Galgame, len(library.Items))}
	for i, item := range library.Items {
		page.Items[i] = toGalgame(item)
	}
	return page, nil
}

func (c *Client) SaveGalgame(ctx context.Context, token string, draft potatovn.GalgameDraft) (potatovn.Galgame, error) {
	payload := galgamePayload{
		BgmID:                draft.BangumiID,
		VndbID:               draft.VNDBID,
		Name:                 draft.Name,
		CnName:               draft.CnName,
		Description:          draft.Description,
		Tags:                 draft.Tags,
		ReleaseDateTimeStamp: draft.ReleaseTimestamp,
		PlayType:             draft.PlayType,
		ImageLoc:             draft.ImageLoc,
	}
	if payload.Tags == nil {
		payload.Tags = []string{}
	}
	var saved galgameResponse
	if err := c.call(ctx, http.MethodPatch, "/galgame", nil, token, payload, &saved); err != nil {
		return potatovn.Galgame{}, translate(err)
	}
	return toGalgame(saved), nil
}

func (c *Client) RemoveGalgame(ctx context.Context, token string, galgameID int) error {
	err := c.call(ctx, http.MethodDelete, "/galgame/"+strconv.Itoa(galgameID), nil, token, nil, nil)
	var status statusError
	if errors.As(err, &status) && status.code == http.StatusNotFound {
		return potatovn.ErrRemoteGalgameMissing
	}
	if err != nil {
		return translate(err)
	}
	return nil
}

func (c *Client) ReserveImage(ctx context.Context, token, objectName string, size int) (string, error) {
	query := url.Values{"objectFullName": {objectName}, "requireSpace": {strconv.Itoa(size)}}
	var raw json.RawMessage
	if err := c.call(ctx, http.MethodGet, "/oss/put", query, token, nil, &raw); err != nil {
		return "", translate(err)
	}
	uploadURL := strings.TrimSpace(string(raw))
	var quoted string
	if err := json.Unmarshal(raw, &quoted); err == nil {
		uploadURL = quoted
	}
	parsed, err := url.Parse(uploadURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", potatovn.ErrRequestFailed.Wrap(fmt.Errorf("potatovn returned an unusable upload url %q", uploadURL))
	}
	return uploadURL, nil
}

func (c *Client) UploadImage(ctx context.Context, uploadURL string, cover potatovn.Cover) error {
	parsed, err := url.Parse(uploadURL)
	if err != nil || parsed.Scheme != "https" {
		return potatovn.ErrRequestFailed.Wrap(fmt.Errorf("refusing to upload to %q", uploadURL))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, parsed.String(), bytes.NewReader(cover.Data))
	if err != nil {
		return fmt.Errorf("build potatovn upload request: %w", err)
	}
	req.Header.Set("Content-Type", cover.ContentType)
	resp, err := c.http.Do(req)
	if err != nil {
		return potatovn.ErrRequestFailed.Wrap(fmt.Errorf("upload cover to potatovn storage: %w", err))
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxResponseBytes))
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return potatovn.ErrRequestFailed.Wrap(fmt.Errorf("upload cover to potatovn storage returned %d", resp.StatusCode))
	}
	return nil
}

func (c *Client) CommitImage(ctx context.Context, token, objectName string) error {
	if err := c.call(ctx, http.MethodPut, "/oss/update", url.Values{"objectFullName": {objectName}}, token, nil, nil); err != nil {
		return translate(err)
	}
	return nil
}

type statusError struct {
	method string
	path   string
	code   int
}

func (e statusError) Error() string {
	return fmt.Sprintf("potatovn %s %s returned %d", e.method, e.path, e.code)
}

func (c *Client) call(ctx context.Context, method, path string, query url.Values, token string, body, out any) error {
	target := c.baseURL + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode potatovn request: %w", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return fmt.Errorf("build potatovn request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("potatovn %s %s: %w", method, path, err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return fmt.Errorf("read potatovn %s %s: %w", method, path, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return statusError{method: method, path: path, code: resp.StatusCode}
	}
	if out == nil {
		return nil
	}
	if rawOut, ok := out.(*json.RawMessage); ok {
		*rawOut = raw
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("decode potatovn %s %s: %w", method, path, err)
	}
	return nil
}

func translate(err error) error {
	var status statusError
	if errors.As(err, &status) && (status.code == http.StatusUnauthorized || status.code == http.StatusForbidden) {
		return potatovn.ErrBindingAuthFailed.Wrap(err)
	}
	return potatovn.ErrRequestFailed.Wrap(err)
}

func toSession(in sessionResponse) (potatovn.Session, error) {
	if in.Token == "" {
		return potatovn.Session{}, potatovn.ErrRequestFailed.Wrap(errors.New("potatovn returned an empty session token"))
	}
	return potatovn.Session{
		UserID:   in.User.ID,
		UserName: in.User.UserName,
		Token:    in.Token,
		Expires:  unix(in.Expire),
	}, nil
}

func toGalgame(in galgameResponse) potatovn.Galgame {
	galgame := potatovn.Galgame{
		ID:            in.ID,
		BangumiID:     in.BgmID.value,
		VNDBID:        in.VndbID.value,
		TotalPlayTime: in.TotalPlayTime,
		PlayType:      in.PlayType,
		MyRate:        in.MyRate,
		Sessions:      make([]potatovn.PlaySession, len(in.PlayTime)),
	}
	for i, entry := range in.PlayTime {
		galgame.Sessions[i] = potatovn.PlaySession{At: unix(entry.DateTimeStamp), Minutes: entry.Minute}
	}
	return galgame
}

func unix(seconds float64) time.Time {
	whole, fraction := math.Modf(seconds)
	return time.Unix(int64(whole), int64(fraction*1e9)).UTC()
}
