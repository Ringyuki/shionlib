package bangumi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const (
	DefaultAPIBaseURL        = "https://api.bgm.tv"
	DefaultRefreshEndpoint   = "https://bgm.tv/oauth/access_token"
	DefaultAuthorizeEndpoint = "https://bgm.tv/oauth/authorize"
	apiUserAgent             = "shionlib/shionlib-backend"
	oauthUserAgent           = "Mozilla/5.0 (compatible; ShionLib/1.0)"
	refreshMargin            = 5 * time.Minute
	maxBodyBytes             = 4 << 20
)

var ErrTokensMissing = errors.New("bangumi tokens are not provisioned; store them before requesting bangumi")

type TokenStore interface {
	Load(ctx context.Context) ([]byte, bool, error)
	Save(ctx context.Context, raw []byte) error
}

type Options struct {
	HTTP         *http.Client
	APIBaseURL   string
	TokenURL     string
	AuthorizeURL string
	Credentials  func() (clientID, clientSecret string)
	Tokens       TokenStore
	Now          func() time.Time
}

type tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type,omitempty"`
	ExpiresIn    int64  `json:"expires_in,omitempty"`
	ExpiresAt    int64  `json:"expires_at,omitempty"`
	SavedAt      int64  `json:"saved_at,omitempty"`
}

func (t *tokens) persisted() map[string]any {
	return map[string]any{
		"access_token":  t.AccessToken,
		"refresh_token": t.RefreshToken,
		"token_type":    t.TokenType,
		"expires_in":    t.ExpiresIn,
		"expires_at":    t.ExpiresAt,
		"saved_at":      t.SavedAt,
	}
}

type Client struct {
	opts      Options
	refreshes singleflight.Group
	mu        sync.Mutex
	cached    *tokens
}

func NewClient(opts Options) *Client {
	if opts.APIBaseURL == "" {
		opts.APIBaseURL = DefaultAPIBaseURL
	}
	if opts.TokenURL == "" {
		opts.TokenURL = DefaultRefreshEndpoint
	}
	if opts.AuthorizeURL == "" {
		opts.AuthorizeURL = DefaultAuthorizeEndpoint
	}
	opts.APIBaseURL = strings.TrimSuffix(opts.APIBaseURL, "/")
	return &Client{opts: opts}
}

type subjectResponse struct {
	ID     int `json:"id"`
	Rating struct {
		Rank  int            `json:"rank"`
		Total int            `json:"total"`
		Count map[string]int `json:"count"`
		Score float64        `json:"score"`
	} `json:"rating"`
}

func (c *Client) Subject(ctx context.Context, subjectID string) (game.BangumiScore, error) {
	raw, err := c.get(ctx, "/v0/subjects/"+url.PathEscape(subjectID))
	if err != nil {
		return game.BangumiScore{}, err
	}
	var subject subjectResponse
	if err := json.Unmarshal(raw, &subject); err != nil {
		return game.BangumiScore{}, game.ErrBangumiRequestFailed.Wrap(err).WithArgs(map[string]any{"message": "invalid response"})
	}
	count := subject.Rating.Count
	if count == nil {
		count = map[string]int{}
	}
	return game.BangumiScore{
		ID:     subject.ID,
		Rating: game.BangumiRating{Rank: subject.Rating.Rank, Total: subject.Rating.Total, Count: count, Score: subject.Rating.Score},
	}, nil
}

func (c *Client) Resource(ctx context.Context, path string) ([]byte, error) {
	segments := strings.Split(path, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	raw, err := c.get(ctx, "/v0/"+strings.Join(segments, "/"))
	if err != nil {
		return nil, err
	}
	if !json.Valid(raw) {
		return nil, game.ErrBangumiRequestFailed.WithArgs(map[string]any{"message": "invalid response"})
	}
	return raw, nil
}

func requestFailed(cause error, message string) error {
	return game.ErrBangumiRequestFailed.Wrap(cause).WithArgs(map[string]any{"message": message})
}

func (c *Client) get(ctx context.Context, path string) ([]byte, error) {
	token, err := c.accessToken(ctx)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.opts.APIBaseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build bangumi request: %w", err)
	}
	req.Header.Set("User-Agent", apiUserAgent)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.opts.HTTP.Do(req)
	if err != nil {
		return nil, requestFailed(err, "network error")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return nil, requestFailed(err, "network error")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := "Request failed with status code " + strconv.Itoa(resp.StatusCode)
		return nil, requestFailed(errors.New(message), message)
	}
	return body, nil
}

func (c *Client) expired(t *tokens) bool {
	if t == nil || t.ExpiresAt == 0 {
		return true
	}
	return c.opts.Now().After(time.UnixMilli(t.ExpiresAt).Add(-refreshMargin))
}

func (c *Client) accessToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	current := c.cached
	c.mu.Unlock()
	if !c.expired(current) {
		return current.AccessToken, nil
	}
	stored, err := c.load(ctx)
	if err != nil {
		return "", err
	}
	if !c.expired(stored) {
		return stored.AccessToken, nil
	}
	refreshed, err, _ := c.refreshes.Do("refresh", func() (any, error) {
		return c.refresh(context.WithoutCancel(ctx), stored.RefreshToken)
	})
	if err != nil {
		return "", err
	}
	return refreshed.(*tokens).AccessToken, nil
}

func (c *Client) load(ctx context.Context) (*tokens, error) {
	raw, found, err := c.opts.Tokens.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrTokensMissing
	}
	var stored tokens
	if err := json.Unmarshal(raw, &stored); err != nil {
		return nil, fmt.Errorf("decode bangumi tokens: %w", err)
	}
	if stored.AccessToken == "" && stored.RefreshToken == "" {
		return nil, ErrTokensMissing
	}
	c.remember(&stored)
	return &stored, nil
}

func (c *Client) remember(t *tokens) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cached = t
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

func (c *Client) refresh(ctx context.Context, refreshToken string) (*tokens, error) {
	if refreshToken == "" {
		return nil, ErrTokensMissing
	}
	clientID, clientSecret := c.opts.Credentials()
	return c.requestTokens(ctx, "refresh", url.Values{
		"grant_type":    {"refresh_token"},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"refresh_token": {refreshToken},
	}, refreshToken)
}

func (c *Client) AuthorizeURL(redirectURI, state string) (string, bool) {
	clientID, clientSecret := c.opts.Credentials()
	if clientID == "" || clientSecret == "" {
		return "", false
	}
	query := url.Values{
		"client_id":     {clientID},
		"response_type": {"code"},
		"redirect_uri":  {redirectURI},
		"state":         {state},
	}
	return c.opts.AuthorizeURL + "?" + query.Encode(), true
}

func (c *Client) Exchange(ctx context.Context, code, redirectURI string) error {
	clientID, clientSecret := c.opts.Credentials()
	_, err := c.requestTokens(ctx, "exchange", url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}, "")
	if err != nil {
		return requestFailed(err, "authorization failed")
	}
	return nil
}

func (c *Client) Authorization(ctx context.Context) (game.BangumiAuthorization, error) {
	clientID, clientSecret := c.opts.Credentials()
	authorization := game.BangumiAuthorization{Configured: clientID != "" && clientSecret != ""}
	stored, err := c.load(ctx)
	if errors.Is(err, ErrTokensMissing) {
		return authorization, nil
	}
	if err != nil {
		return game.BangumiAuthorization{}, err
	}
	authorization.Authorized = stored.RefreshToken != "" || !c.expired(stored)
	if stored.ExpiresAt != 0 {
		expires := time.UnixMilli(stored.ExpiresAt).UTC()
		authorization.ExpiresAt = &expires
	}
	return authorization, nil
}

func (c *Client) requestTokens(ctx context.Context, purpose string, form url.Values, keptRefreshToken string) (*tokens, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.opts.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("build bangumi token %s: %w", purpose, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", oauthUserAgent)
	resp, err := c.opts.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s bangumi token: %w", purpose, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s bangumi token: status %d", purpose, resp.StatusCode)
	}
	var body tokenResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxBodyBytes)).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode bangumi token %s: %w", purpose, err)
	}
	if body.AccessToken == "" {
		return nil, fmt.Errorf("%s bangumi token: empty access token", purpose)
	}
	now := c.opts.Now()
	issued := &tokens{
		AccessToken:  body.AccessToken,
		RefreshToken: body.RefreshToken,
		TokenType:    body.TokenType,
		ExpiresIn:    body.ExpiresIn,
		ExpiresAt:    now.Add(time.Duration(body.ExpiresIn) * time.Second).UnixMilli(),
		SavedAt:      now.UnixMilli(),
	}
	if issued.TokenType == "" {
		issued.TokenType = "Bearer"
	}
	if issued.RefreshToken == "" {
		issued.RefreshToken = keptRefreshToken
	}
	raw, err := json.Marshal(issued.persisted())
	if err != nil {
		return nil, fmt.Errorf("encode bangumi tokens: %w", err)
	}
	if err := c.opts.Tokens.Save(ctx, raw); err != nil {
		return nil, err
	}
	c.remember(issued)
	return issued, nil
}
