package indexnow

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

const DefaultEndpoint = "https://api.indexnow.org/indexnow"

type Options struct {
	Endpoint string
	SiteURL  string
	Key      string
	Client   *http.Client
}

type Submitter struct {
	endpoint    string
	host        string
	key         string
	keyLocation string
	client      *http.Client
}

func KeyFrom(secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("indexnow"))
	return hex.EncodeToString(mac.Sum(nil))[:32]
}

func New(opts Options) *Submitter {
	host := ""
	if parsed, err := url.Parse(opts.SiteURL); err == nil {
		host = parsed.Host
	}
	return &Submitter{endpoint: opts.Endpoint, host: host, key: opts.Key, keyLocation: opts.SiteURL + "/indexnow.txt", client: opts.Client}
}

type submission struct {
	Host        string   `json:"host"`
	Key         string   `json:"key"`
	KeyLocation string   `json:"keyLocation"`
	URLList     []string `json:"urlList"`
}

func (s *Submitter) Submit(ctx context.Context, urls []string) error {
	payload, err := json.Marshal(submission{Host: s.host, Key: s.key, KeyLocation: s.keyLocation, URLList: urls})
	if err != nil {
		return fmt.Errorf("encode indexnow submission: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build indexnow request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("call indexnow: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusAccepted {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<12))
	return fmt.Errorf("indexnow refused %d addresses with status %d: %s", len(urls), resp.StatusCode, body)
}
