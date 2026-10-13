package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"slices"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const (
	maxErrorBody     = 1 << 20
	maxFailureText   = 300
	maxFailureBody   = 4000
	failureSeparator = " · "
)

var errIdle = errors.New("no data received before the idle timeout")

var paramNames = map[string]string{
	"temperature":           ai.ParamTemperature,
	"max_tokens":            ai.ParamMaxOutputTokens,
	"max_completion_tokens": ai.ParamMaxOutputTokens,
	"max_output_tokens":     ai.ParamMaxOutputTokens,
	"maxoutputtokens":       ai.ParamMaxOutputTokens,
}

var (
	protocolText   = regexp.MustCompile(`protocol_not_supported|model must be one of|not support(?:ed)? (?:the )?(?:chat[ _/.-]?completions?|responses?|messages?)(?: api| protocol| endpoint)?|only supported in v1/responses|use the responses api|not a chat model|unsupported endpoint|endpoint (?:is )?not supported|invalid url|not implemented|no route matched|404 page not found|不支持.{0,12}(?:chat|responses|messages|接口|协议|端点)`)
	paramText      = regexp.MustCompile("[\x27\"\x60]?(temperature|max_tokens|max_completion_tokens|max_output_tokens|maxoutputtokens)[\x27\"\x60]?[^\n]{0,80}?(?:unsupported|not supported|does not support|is not allowed|not permitted|only the default|invalid|unknown)|(?:unsupported|unknown|invalid|unrecognized) (?:parameter|value|field|argument)[^\n]{0,20}?[\x27\"\x60]?(temperature|max_tokens|max_completion_tokens|max_output_tokens|maxoutputtokens)")
	structuredText = regexp.MustCompile(`response_format|json_schema|structured output|text\.format|json mode|response_?schema|response_mime_type|output_format`)
	rejectedText   = regexp.MustCompile(`not support|unsupported|invalid|unknown|not allowed|not permitted|unrecognized`)
	authText       = regexp.MustCompile(`invalid[_ ]api[_ ]key|incorrect api key|unauthori[sz]ed|authentication|无效的令牌|令牌无效|api key not valid`)
	quotaText      = regexp.MustCompile(`insufficient|quota|balance|billing|余额|额度|credit`)
	notFoundText   = regexp.MustCompile(`model[_ ]not[_ ]found|model .{0,80}(?:does not exist|not found|not available|is not supported)|no available (?:channel|model)|无可用渠道|模型不存在|unknown model|invalid model`)
	networkText    = regexp.MustCompile(`econnrefused|enotfound|econnreset|etimedout|socket hang up|cannot connect|connection refused|connection reset|no such host|broken pipe|eof`)
	geminiPath     = regexp.MustCompile(`(?i):(?:stream)?generatecontent$`)
)

func describeHTTP(status int, url, body, fallback string) *ai.Failure {
	text := strings.ToLower(fallback + "\n" + body)
	location := url
	if status != 0 {
		location = fmt.Sprintf("%d %s", status, url)
	}
	content := body
	if content == "" {
		content = fallback
	}
	detail := clip(location+"\n"+content, maxFailureBody)
	summary := upstreamMessage(body)
	if summary == "" {
		summary = fallback
	}
	var parts []string
	if status != 0 {
		parts = append(parts, fmt.Sprintf("HTTP %d", status))
	}
	if summary != "" {
		parts = append(parts, summary)
	}
	message := clip(strings.Join(parts, failureSeparator), maxFailureText)
	failure := func(kind ai.ErrorKind) *ai.Failure {
		return &ai.Failure{Kind: kind, Message: message, Detail: detail}
	}
	path, _, _ := strings.Cut(url, "?")
	path = strings.TrimRight(path, "/")
	chat := !strings.HasSuffix(path, "/responses") && !strings.HasSuffix(path, "/messages") && !geminiPath.MatchString(path)
	clientError := status == http.StatusBadRequest || status == http.StatusUnprocessableEntity
	switch {
	case slices.Contains([]int{400, 404, 405, 415, 422, 501}, status) &&
		(protocolText.MatchString(text) || ((status == 404 || status == 405) && !chat && !strings.Contains(text, "model"))):
		return failure(ai.ErrorProtocol)
	case clientError && paramText.MatchString(text):
		match := paramText.FindStringSubmatch(text)
		name := match[1]
		if name == "" {
			name = match[2]
		}
		result := failure(ai.ErrorParam)
		result.Param = paramNames[name]
		return result
	case clientError && structuredText.MatchString(text) && rejectedText.MatchString(text):
		return failure(ai.ErrorStructured)
	case status == http.StatusUnauthorized || status == http.StatusForbidden || authText.MatchString(text):
		return failure(ai.ErrorAuth)
	case status == http.StatusPaymentRequired || (quotaText.MatchString(text) && status != http.StatusBadRequest):
		return failure(ai.ErrorQuota)
	case status == http.StatusNotFound || notFoundText.MatchString(text):
		return failure(ai.ErrorNotFound)
	case status == http.StatusTooManyRequests:
		return failure(ai.ErrorRateLimit)
	case status >= 500:
		return failure(ai.ErrorUpstream)
	case status == 0 && networkText.MatchString(text):
		return failure(ai.ErrorNetwork)
	}
	return failure(ai.ErrorOther)
}

func upstreamMessage(body string) string {
	raw := strings.TrimSpace(body)
	if raw == "" || strings.HasPrefix(raw, "<") {
		return ""
	}
	var data struct {
		Error   json.RawMessage `json:"error"`
		Message json.RawMessage `json:"message"`
		Detail  json.RawMessage `json:"detail"`
	}
	if err := json.Unmarshal([]byte(raw), &data); err != nil {
		first, _, _ := strings.Cut(raw, "\n")
		return first
	}
	if text, ok := jsonString(data.Error); ok {
		return strings.TrimSpace(text)
	}
	var nested struct {
		Message json.RawMessage `json:"message"`
	}
	if len(data.Error) > 0 && json.Unmarshal(data.Error, &nested) == nil {
		if text, ok := jsonString(nested.Message); ok {
			return strings.TrimSpace(text)
		}
	}
	for _, candidate := range []json.RawMessage{data.Message, data.Detail} {
		if text, ok := jsonString(candidate); ok {
			return strings.TrimSpace(text)
		}
	}
	return ""
}

func jsonString(raw json.RawMessage) (string, bool) {
	var text string
	if len(raw) == 0 || json.Unmarshal(raw, &text) != nil {
		return "", false
	}
	return text, true
}

func responseFailure(resp *http.Response, url string) *ai.Failure {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBody))
	return describeHTTP(resp.StatusCode, url, string(body), http.StatusText(resp.StatusCode))
}

func transportFailure(ctx context.Context, err error, url string) *ai.Failure {
	message := err.Error()
	detail := clip(url+"\n"+message, maxFailureBody)
	switch {
	case errors.Is(context.Cause(ctx), errIdle):
		return &ai.Failure{Kind: ai.ErrorTimeout, Message: errIdle.Error(), Detail: detail}
	case errors.Is(err, context.DeadlineExceeded) || errors.Is(context.Cause(ctx), context.DeadlineExceeded):
		return &ai.Failure{Kind: ai.ErrorTimeout, Message: "the request timed out", Detail: detail}
	case errors.Is(err, context.Canceled):
		return &ai.Failure{Kind: ai.ErrorOther, Message: "the request was canceled", Detail: detail}
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return &ai.Failure{Kind: ai.ErrorTimeout, Message: clip(message, maxFailureText), Detail: detail}
	}
	return &ai.Failure{Kind: ai.ErrorNetwork, Message: clip(rootMessage(err), maxFailureText), Detail: detail}
}

func rootMessage(err error) string {
	for {
		next := errors.Unwrap(err)
		if next == nil {
			return err.Error()
		}
		err = next
	}
}

func streamFailure(url, code, message, raw string, status int) *ai.Failure {
	if status == 0 {
		status = statusForCode(code)
	}
	fallback := message
	if fallback == "" {
		fallback = code
	}
	return describeHTTP(status, url, raw, fallback)
}

func statusForCode(code string) int {
	lowered := strings.ToLower(code)
	switch {
	case lowered == "":
		return 0
	case strings.Contains(lowered, "rate_limit") || strings.Contains(lowered, "resource_exhausted"):
		return http.StatusTooManyRequests
	case strings.Contains(lowered, "quota") || strings.Contains(lowered, "billing"):
		return http.StatusPaymentRequired
	case strings.Contains(lowered, "api_key") || strings.Contains(lowered, "authentication") || strings.Contains(lowered, "unauthenticated") || strings.Contains(lowered, "permission"):
		return http.StatusUnauthorized
	case strings.Contains(lowered, "not_found"):
		return http.StatusNotFound
	case strings.Contains(lowered, "overloaded") || strings.Contains(lowered, "server_error") || strings.Contains(lowered, "api_error") || strings.Contains(lowered, "internal") || strings.Contains(lowered, "unavailable"):
		return http.StatusInternalServerError
	case strings.Contains(lowered, "invalid"):
		return http.StatusBadRequest
	}
	return 0
}

func protocolFailure(url, message, detail string) *ai.Failure {
	return &ai.Failure{Kind: ai.ErrorProtocol, Message: clip(message, maxFailureText), Detail: clip(url+"\n"+detail, maxFailureBody)}
}

func clip(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "…"
}
