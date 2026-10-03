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
	base    string
	http    *http.Client
	limiter *rate.Limiter
}

func NewClient(opts Options) *Client {
	base := opts.HTTPClient
	if base == nil {
		base = &http.Client{}
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
	tokenCtx := context.WithValue(context.Background(), oauth2.HTTPClient, base)
	authorized := &http.Client{
		Timeout:   base.Timeout,
		Transport: &oauth2.Transport{Source: credentials.TokenSource(tokenCtx), Base: base.Transport},
	}
	limit := rate.Inf
	if opts.RequestsPerMin > 0 {
		limit = rate.Every(time.Minute / time.Duration(opts.RequestsPerMin))
	}
	return &Client{
		base:    strings.TrimRight(opts.BaseURL, "/"),
		http:    authorized,
		limiter: rate.NewLimiter(limit, 1),
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
	if err := c.limiter.Wait(ctx); err != nil {
		return fmt.Errorf("hikarinagi %s: %w", path, err)
	}
	target := c.base + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return fmt.Errorf("hikarinagi %s: %w", path, err)
	}
	request.Header.Set("Accept", "application/json")
	response, err := c.http.Do(request)
	if err != nil {
		var retrieve *oauth2.RetrieveError
		if errors.As(err, &retrieve) {
			return fmt.Errorf("hikarinagi token: status %d: %w", retrieve.Response.StatusCode, err)
		}
		return fmt.Errorf("hikarinagi %s: %w", path, err)
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
