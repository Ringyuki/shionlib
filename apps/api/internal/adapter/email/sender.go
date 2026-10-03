package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
)

const (
	ProviderElastic = "elastic"
	ProviderPostal  = "postal"
	maxErrorBody    = 2048
)

type Message struct {
	Subject string
	To      []string
	HTML    string
}

type Sender interface {
	Send(ctx context.Context, msg Message) error
}

type Settings struct {
	Provider      string
	APIKey        string
	Endpoint      string
	SenderAddress string
	SenderName    string
}

func NewSender(settings Settings, client *http.Client) Sender {
	client = ipv4Only(client)
	switch settings.Provider {
	case ProviderElastic:
		return &Elastic{settings: settings, client: client}
	case ProviderPostal:
		return &Postal{settings: settings, client: client}
	default:
		return unsupported{provider: settings.Provider}
	}
}

type unsupported struct {
	provider string
}

func (u unsupported) Send(context.Context, Message) error {
	return fmt.Errorf("unsupported email provider %q", u.provider)
}

type Elastic struct {
	settings Settings
	client   *http.Client
}

func (e *Elastic) Send(ctx context.Context, msg Message) error {
	query := url.Values{}
	query.Set("apikey", e.settings.APIKey)
	query.Set("subject", msg.Subject)
	query.Set("from", e.settings.SenderAddress)
	query.Set("fromName", e.settings.SenderName)
	query.Set("senderName", e.settings.SenderName)
	query.Set("to", strings.Join(msg.To, ";"))
	query.Set("bodyHtml", msg.HTML)
	query.Set("isTransactional", "true")
	endpoint, err := url.Parse(e.settings.Endpoint)
	if err != nil {
		return fmt.Errorf("elastic email endpoint: %w", err)
	}
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), http.NoBody)
	if err != nil {
		return fmt.Errorf("build elastic email request: %w", err)
	}
	_, err = do(e.client, req)
	return err
}

type Postal struct {
	settings Settings
	client   *http.Client
}

type postalRequest struct {
	Subject  string   `json:"subject"`
	From     string   `json:"from"`
	To       []string `json:"to"`
	HTMLBody string   `json:"html_body"`
}

type postalResponse struct {
	Status string `json:"status"`
}

func (p *Postal) Send(ctx context.Context, msg Message) error {
	body, err := json.Marshal(postalRequest{
		Subject:  msg.Subject,
		From:     fmt.Sprintf("%q <%s>", p.settings.SenderName, p.settings.SenderAddress),
		To:       msg.To,
		HTMLBody: msg.HTML,
	})
	if err != nil {
		return fmt.Errorf("encode postal request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.settings.Endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build postal request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Server-API-Key", p.settings.APIKey)
	raw, err := do(p.client, req)
	if err != nil {
		return err
	}
	var decoded postalResponse
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return fmt.Errorf("decode postal response: %w", err)
	}
	if decoded.Status != "success" {
		return fmt.Errorf("postal rejected the message with status %q", decoded.Status)
	}
	return nil
}

func do(client *http.Client, req *http.Request) ([]byte, error) {
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send email: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read email response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("email provider responded %d: %s", resp.StatusCode, truncate(raw))
	}
	return raw, nil
}

func truncate(raw []byte) string {
	if len(raw) > maxErrorBody {
		raw = raw[:maxErrorBody]
	}
	return string(raw)
}

func ipv4Only(client *http.Client) *http.Client {
	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		return client
	}
	clone := transport.Clone()
	base := clone.DialContext
	if base == nil {
		base = (&net.Dialer{}).DialContext
	}
	clone.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		if network == "tcp" {
			network = "tcp4"
		}
		return base(ctx, network, address)
	}
	copied := *client
	copied.Transport = clone
	return &copied
}

var errNoRecipient = errors.New("email has no recipient")
