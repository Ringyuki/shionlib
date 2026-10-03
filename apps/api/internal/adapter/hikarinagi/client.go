package hikarinagi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
	"golang.org/x/time/rate"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

const maxErrorBody = 512

type Options struct {
	BaseURL        string
	TokenURL       string
	ClientID       string
	ClientSecret   string
	Resource       string
	Scopes         []string
	RequestsPerMin int
	HTTPClient     *http.Client
}

type Client struct {
	base        string
	http        *http.Client
	credentials clientcredentials.Config
	limiter     *rate.Limiter
	mu          sync.Mutex
	token       *oauth2.Token
}

func NewClient(opts Options) *Client {
	httpClient := opts.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{}
	}
	credentials := clientcredentials.Config{
		ClientID:     opts.ClientID,
		ClientSecret: opts.ClientSecret,
		TokenURL:     opts.TokenURL,
		Scopes:       opts.Scopes,
	}
	if opts.Resource != "" {
		credentials.EndpointParams = url.Values{"resource": {opts.Resource}}
	}
	limit := rate.Inf
	if opts.RequestsPerMin > 0 {
		limit = rate.Every(time.Minute / time.Duration(opts.RequestsPerMin))
	}
	return &Client{
		base:        strings.TrimRight(opts.BaseURL, "/"),
		http:        httpClient,
		credentials: credentials,
		limiter:     rate.NewLimiter(limit, 1),
	}
}

func (c *Client) accessToken(ctx context.Context) (*oauth2.Token, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token.Valid() {
		return c.token, nil
	}
	token, err := c.credentials.Token(context.WithValue(ctx, oauth2.HTTPClient, c.http))
	if err != nil {
		var retrieve *oauth2.RetrieveError
		if errors.As(err, &retrieve) && retrieve.Response != nil {
			return nil, fmt.Errorf("hikarinagi token: status %d: %w", retrieve.Response.StatusCode, err)
		}
		return nil, fmt.Errorf("hikarinagi token: %w", err)
	}
	c.token = token
	return token, nil
}

func (c *Client) forgetToken(stale *oauth2.Token) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token == stale {
		c.token = nil
	}
}

func (c *Client) send(ctx context.Context, path, target string) (*http.Response, error) {
	for attempt := 0; ; attempt++ {
		if err := c.limiter.Wait(ctx); err != nil {
			return nil, fmt.Errorf("hikarinagi %s: %w", path, err)
		}
		token, err := c.accessToken(ctx)
		if err != nil {
			return nil, err
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
		if err != nil {
			return nil, fmt.Errorf("hikarinagi %s: %w", path, err)
		}
		request.Header.Set("Accept", "application/json")
		token.SetAuthHeader(request)
		response, err := c.http.Do(request)
		if err != nil {
			return nil, fmt.Errorf("hikarinagi %s: %w", path, err)
		}
		if response.StatusCode != http.StatusUnauthorized || attempt > 0 {
			return response, nil
		}
		_ = response.Body.Close()
		c.forgetToken(token)
	}
}

type envelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (c *Client) get(ctx context.Context, path string, query url.Values, out any) error {
	target := c.base + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	response, err := c.send(ctx, path, target)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	switch {
	case response.StatusCode == http.StatusNotFound:
		return catalog.ErrNotFound
	case response.StatusCode == http.StatusTooManyRequests:
		return catalog.ErrRateLimited
	case response.StatusCode < 200 || response.StatusCode >= 300:
		body, _ := io.ReadAll(io.LimitReader(response.Body, maxErrorBody))
		return fmt.Errorf("hikarinagi %s: status %d: %s", path, response.StatusCode, strings.TrimSpace(string(body)))
	}
	var payload envelope
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return fmt.Errorf("hikarinagi %s: decode envelope: %w", path, err)
	}
	if !payload.Success {
		if payload.Error != nil {
			return fmt.Errorf("hikarinagi %s: %s: %s", path, payload.Error.Code, payload.Error.Message)
		}
		return fmt.Errorf("hikarinagi %s: unsuccessful response", path)
	}
	if len(payload.Data) == 0 || string(payload.Data) == "null" {
		return catalog.ErrNotFound
	}
	if err := json.Unmarshal(payload.Data, out); err != nil {
		return fmt.Errorf("hikarinagi %s: decode data: %w", path, err)
	}
	return nil
}
