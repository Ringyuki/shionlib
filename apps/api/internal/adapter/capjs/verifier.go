package capjs

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const (
	maxBodyBytes = 1 << 20
	foreignToken = "Token was not issued for this site key"
)

var ErrNotConfigured = errors.New("cap: CAP_URL, CAP_SITE_KEY and CAP_SECRET are not all set")

type Options struct {
	URL     string
	SiteKey string
	Secret  string
	Client  *http.Client
}

type Verifier struct {
	endpoint string
	prefix   string
	secret   string
	client   *http.Client
}

func New(opts Options) *Verifier {
	endpoint := ""
	if opts.URL != "" && opts.SiteKey != "" && opts.Secret != "" {
		endpoint = strings.TrimRight(opts.URL, "/") + "/" + url.PathEscape(opts.SiteKey) + "/siteverify"
	}
	return &Verifier{endpoint: endpoint, prefix: opts.SiteKey + ":", secret: opts.Secret, client: opts.Client}
}

type verifyResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

func (v *Verifier) Verify(ctx context.Context, token string) (download.Verdict, error) {
	if v.endpoint == "" {
		return download.Verdict{}, ErrNotConfigured
	}
	if !strings.HasPrefix(token, v.prefix) {
		return download.Verdict{ErrorCodes: []string{foreignToken}}, nil
	}
	payload, err := json.Marshal(map[string]string{"secret": v.secret, "response": token})
	if err != nil {
		return download.Verdict{}, fmt.Errorf("encode cap request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.endpoint, bytes.NewReader(payload))
	if err != nil {
		return download.Verdict{}, fmt.Errorf("build cap request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := v.client.Do(req)
	if err != nil {
		return download.Verdict{}, fmt.Errorf("call cap: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return download.Verdict{}, fmt.Errorf("read cap response: %w", err)
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return download.Verdict{}, fmt.Errorf("cap responded with status %d", resp.StatusCode)
	}
	var decoded verifyResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return download.Verdict{}, fmt.Errorf("decode cap response (status %d): %w", resp.StatusCode, err)
	}
	if decoded.Success {
		return download.Verdict{Success: true, ErrorCodes: []string{}}, nil
	}
	if rejectsCaller(resp.StatusCode, decoded.Error) {
		return download.Verdict{}, fmt.Errorf("cap rejected the site key or secret (status %d): %s", resp.StatusCode, decoded.Error)
	}
	reason := decoded.Error
	if reason == "" {
		reason = http.StatusText(resp.StatusCode)
	}
	return download.Verdict{ErrorCodes: []string{reason}}, nil
}

func rejectsCaller(status int, reason string) bool {
	return status == http.StatusUnauthorized || strings.Contains(reason, "site key or secret")
}
