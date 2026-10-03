package turnstile

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const (
	DefaultURL   = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	maxBodyBytes = 1 << 20
)

type Verifier struct {
	secret string
	url    string
	client *http.Client
}

func New(secret, url string, client *http.Client) *Verifier {
	if url == "" {
		url = DefaultURL
	}
	return &Verifier{secret: secret, url: url, client: client}
}

type verifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

func (v *Verifier) Verify(ctx context.Context, token string) (download.Verdict, error) {
	payload, err := json.Marshal(map[string]string{"response": token, "secret": v.secret})
	if err != nil {
		return download.Verdict{}, fmt.Errorf("encode turnstile request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.url, bytes.NewReader(payload))
	if err != nil {
		return download.Verdict{}, fmt.Errorf("build turnstile request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := v.client.Do(req)
	if err != nil {
		return download.Verdict{}, fmt.Errorf("call turnstile: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return download.Verdict{}, fmt.Errorf("read turnstile response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return download.Verdict{}, fmt.Errorf("turnstile responded with status %d", resp.StatusCode)
	}
	var decoded verifyResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return download.Verdict{}, fmt.Errorf("decode turnstile response: %w", err)
	}
	codes := decoded.ErrorCodes
	if codes == nil {
		codes = []string{}
	}
	return download.Verdict{Success: decoded.Success, ErrorCodes: codes}, nil
}
