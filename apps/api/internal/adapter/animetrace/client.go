package animetrace

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"slices"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

const (
	Name             = "animetrace"
	DefaultEndpoint  = "https://api.animetrace.com/v1/search"
	maxResponseBytes = 1 << 20
)

var source = search.ImageSource{Name: "AnimeTrace", URL: "https://www.animetrace.com/"}

var (
	answeredCodes    = []int{0, 200, 17720}
	busyCodes        = []int{17702, 17704, 17728, 17731, 17737}
	unsupportedCodes = []int{17705}
	extensions       = map[string]string{"image/webp": ".webp", "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif"}
)

type Pacer interface {
	Reserve(ctx context.Context, pace ratelimit.Pace) (time.Duration, bool, error)
}

type Options struct {
	HTTP     *http.Client
	Pacer    Pacer
	Settings setting.Source
	Endpoint string
}

type Client struct {
	http     *http.Client
	pacer    Pacer
	settings setting.Source
	endpoint string
}

func NewClient(opts Options) *Client {
	endpoint := opts.Endpoint
	if endpoint == "" {
		endpoint = DefaultEndpoint
	}
	return &Client{http: opts.HTTP, pacer: opts.Pacer, settings: opts.Settings, endpoint: endpoint}
}

func (c *Client) Source() search.ImageSource {
	return source
}

type answer struct {
	Code    int     `json:"code"`
	TraceID string  `json:"trace_id"`
	Data    []found `json:"data"`
}

type found struct {
	Box          []float64   `json:"box"`
	NotConfident bool        `json:"not_confident"`
	Character    []candidate `json:"character"`
}

type candidate struct {
	Work      string `json:"work"`
	Character string `json:"character"`
}

func (c *Client) Recognize(ctx context.Context, image []byte) ([]search.Sighting, error) {
	if err := c.awaitTurn(ctx); err != nil {
		return nil, err
	}
	body, contentType, err := form(image)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, body)
	if err != nil {
		return nil, fmt.Errorf("build the animetrace request: %w", err)
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, search.ErrImageFailed.Wrap(fmt.Errorf("animetrace request: %w", err))
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, search.ErrImageFailed.Wrap(fmt.Errorf("read the animetrace answer: %w", err))
	}
	var reply answer
	decodeErr := json.Unmarshal(raw, &reply)
	if resp.StatusCode != http.StatusOK || decodeErr != nil || !slices.Contains(answeredCodes, reply.Code) {
		return nil, refusal(resp.StatusCode, reply, decodeErr)
	}
	return sightings(reply.Data), nil
}

func (c *Client) awaitTurn(ctx context.Context) error {
	wait, ok, err := c.pacer.Reserve(ctx, ratelimit.Pace{Name: Name, Interval: Interval.Read(c.settings), MaxWait: MaxWait.Read(c.settings)})
	if err != nil {
		return search.ErrImageFailed.Wrap(err)
	}
	if !ok {
		return search.ErrImageBusy.Wrap(fmt.Errorf("the animetrace queue is longer than %s", MaxWait.Read(c.settings)))
	}
	if wait <= 0 {
		return nil
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func form(image []byte) (*bytes.Buffer, string, error) {
	contentType := http.DetectContentType(image)
	extension, ok := extensions[contentType]
	if !ok {
		extension = ".bin"
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="file"; filename="picture`+extension+`"`)
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		return nil, "", fmt.Errorf("start the animetrace form: %w", err)
	}
	if _, err := part.Write(image); err != nil {
		return nil, "", fmt.Errorf("write the picture into the animetrace form: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, "", fmt.Errorf("close the animetrace form: %w", err)
	}
	return &body, writer.FormDataContentType(), nil
}

func refusal(status int, reply answer, decodeErr error) error {
	cause := fmt.Errorf("animetrace answered %d with code %d (trace %q)", status, reply.Code, reply.TraceID)
	if decodeErr != nil {
		cause = fmt.Errorf("animetrace answered %d: %w", status, decodeErr)
	}
	switch {
	case status == http.StatusTooManyRequests || status == http.StatusServiceUnavailable || slices.Contains(busyCodes, reply.Code):
		return search.ErrImageBusy.Wrap(cause)
	case slices.Contains(unsupportedCodes, reply.Code):
		return search.ErrImageUnsupported.Wrap(cause)
	}
	return search.ErrImageFailed.Wrap(cause)
}

func sightings(data []found) []search.Sighting {
	out := make([]search.Sighting, 0, len(data))
	for _, item := range data {
		if len(item.Character) == 0 || len(item.Box) != 4 {
			continue
		}
		best := item.Character[0]
		out = append(out, search.Sighting{
			Box:    box(item.Box),
			Name:   strings.TrimSpace(best.Character),
			Work:   strings.TrimSpace(best.Work),
			Unsure: item.NotConfident,
		})
	}
	return out
}

func box(raw []float64) search.Box {
	clamp := func(value float64) float64 { return min(max(value, 0), 1) }
	return search.Box{
		Left:   clamp(min(raw[0], raw[2])),
		Top:    clamp(min(raw[1], raw[3])),
		Right:  clamp(max(raw[0], raw[2])),
		Bottom: clamp(max(raw[1], raw[3])),
	}
}
