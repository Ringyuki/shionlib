package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const (
	maxLine         = 4 << 20
	maxResponseBody = 16 << 20
)

var errLineTooLong = errors.New("stream line exceeds the size limit")

type sseEvent struct {
	Name string
	Data string
}

type eventHandler func(event sseEvent, state *streamState) (*ai.Failure, error)

type streamState struct {
	url        string
	started    time.Time
	firstToken time.Duration
	text       strings.Builder
	finish     ai.FinishReason
	usage      ai.Usage
	done       bool
}

func newStreamState() *streamState {
	return &streamState{started: time.Now()}
}

func (s *streamState) token() {
	if s.firstToken > 0 {
		return
	}
	s.firstToken = max(time.Since(s.started), time.Nanosecond)
}

func (s *streamState) write(text string) {
	if text == "" {
		return
	}
	s.token()
	s.text.WriteString(text)
}

func (s *streamState) finished(reason ai.FinishReason) {
	s.finish = reason
}

func (s *streamState) completion() ai.Completion {
	return ai.Completion{Text: s.text.String(), FinishReason: s.finish, Usage: s.usage, FirstToken: s.firstToken}
}

type sseReader struct {
	reader *bufio.Reader
	touch  func()
}

func (r *sseReader) line() (string, error) {
	var buffer []byte
	for {
		chunk, err := r.reader.ReadSlice('\n')
		buffer = append(buffer, chunk...)
		if len(buffer) > maxLine {
			return "", errLineTooLong
		}
		if errors.Is(err, bufio.ErrBufferFull) {
			continue
		}
		if err != nil && (!errors.Is(err, io.EOF) || len(buffer) == 0) {
			return "", err
		}
		r.touch()
		return strings.TrimRight(string(buffer), "\r\n"), nil
	}
}

func (r *sseReader) next() (sseEvent, error) {
	var (
		name string
		data []string
	)
	for {
		line, err := r.line()
		if errors.Is(err, io.EOF) && len(data) > 0 {
			return sseEvent{Name: name, Data: strings.Join(data, "\n")}, nil
		}
		if err != nil {
			return sseEvent{}, err
		}
		if line == "" {
			if len(data) > 0 {
				return sseEvent{Name: name, Data: strings.Join(data, "\n")}, nil
			}
			name = ""
			continue
		}
		if strings.HasPrefix(line, ":") {
			continue
		}
		field, value, _ := strings.Cut(line, ":")
		value = strings.TrimPrefix(value, " ")
		switch field {
		case "event":
			name = value
		case "data":
			data = append(data, value)
		}
	}
}

func (c *Client) stream(ctx context.Context, url string, headers http.Header, body any, idle time.Duration, handle eventHandler, state *streamState) error {
	state.url = url
	ctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	timer := time.AfterFunc(idle, func() { cancel(errIdle) })
	defer timer.Stop()
	resp, err := c.send(ctx, http.MethodPost, url, headers, body)
	if err != nil {
		return transportFailure(ctx, err, url)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return responseFailure(resp, url)
	}
	mediaType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if mediaType == "application/json" {
		return c.single(ctx, resp, url, handle, state)
	}
	if mediaType != "" && mediaType != "text/event-stream" && mediaType != "text/plain" {
		preview, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBody))
		return protocolFailure(url, "unexpected content type "+mediaType, string(preview))
	}
	reader := &sseReader{reader: bufio.NewReaderSize(resp.Body, 64<<10), touch: func() { timer.Reset(idle) }}
	for !state.done {
		event, err := reader.next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return readFailure(ctx, err, url)
		}
		if strings.TrimSpace(event.Data) == "[DONE]" {
			state.done = true
			break
		}
		failure, err := handle(event, state)
		if failure != nil {
			return failure
		}
		if err != nil {
			return protocolFailure(url, "unexpected stream event: "+err.Error(), event.Data)
		}
	}
	if state.finish == "" {
		return &ai.Failure{Kind: ai.ErrorNetwork, Message: "the stream ended before the response finished", Detail: clip(url+"\n"+state.text.String(), maxFailureBody)}
	}
	return nil
}

func (c *Client) single(ctx context.Context, resp *http.Response, url string, handle eventHandler, state *streamState) error {
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBody))
	if err != nil {
		return readFailure(ctx, err, url)
	}
	trimmed := bytes.TrimSpace(data)
	events := []string{string(trimmed)}
	if bytes.HasPrefix(trimmed, []byte("[")) {
		var items []json.RawMessage
		if err := json.Unmarshal(trimmed, &items); err != nil {
			return protocolFailure(url, "unexpected response body: "+err.Error(), string(trimmed))
		}
		events = events[:0]
		for _, item := range items {
			events = append(events, string(item))
		}
	}
	for _, data := range events {
		failure, err := handle(sseEvent{Data: data}, state)
		if failure != nil {
			return failure
		}
		if err != nil {
			return protocolFailure(url, "unexpected response body: "+err.Error(), data)
		}
	}
	if state.finish == "" {
		state.finished(ai.FinishOther)
	}
	return nil
}

func readFailure(ctx context.Context, err error, url string) *ai.Failure {
	if errors.Is(err, errLineTooLong) {
		return protocolFailure(url, err.Error(), "")
	}
	return transportFailure(ctx, err, url)
}
