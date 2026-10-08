package messagehttp

import (
	"context"
	"encoding/json"
	"maps"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const (
	textPrefix    = "Messages."
	gameTitleArg  = "game_title"
	excerptRunes  = 120
	excerptSuffix = "…"
	timeLayout    = "2006-01-02 15:04"
)

var siteZone = time.FixedZone("UTC+8", 8*60*60)

var valueLabels = map[string][]string{
	"reason":          {"message.report.reason.", "Messages.Value.reason."},
	"malicious_level": {"message.report.level."},
}

var timeArgs = []string{"review_deadline"}

var gameTitleArgs = map[i18n.Locale][]string{
	i18n.LocaleZH: {"game_title_zh", "game_title_jp", "game_title_en"},
	i18n.LocaleEN: {"game_title_en", "game_title_jp", "game_title_zh"},
	i18n.LocaleJA: {"game_title_jp", "game_title_zh", "game_title_en"},
}

type messageTextDTO struct {
	Title    string
	Content  string
	LinkText *string
}

func written(ctx context.Context, resp *response.Builder, m message.Message) messageTextDTO {
	args := textArgs(ctx, resp, m.Meta)
	out := messageTextDTO{Title: text(ctx, resp, m.Title, args), Content: text(ctx, resp, m.Content, args)}
	if m.LinkText != nil {
		linkText := text(ctx, resp, *m.LinkText, args)
		out.LinkText = &linkText
	}
	return out
}

func text(ctx context.Context, resp *response.Builder, stored string, args map[string]any) string {
	if !strings.HasPrefix(stored, textPrefix) {
		return stored
	}
	return resp.Translate(ctx, stored, args)
}

func textArgs(ctx context.Context, resp *response.Builder, raw json.RawMessage) map[string]any {
	var meta map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &meta) != nil {
		return map[string]any{}
	}
	args := maps.Clone(meta)
	for name, prefixes := range valueLabels {
		if code, ok := meta[name].(string); ok {
			args[name] = valueLabel(ctx, resp, prefixes, code)
		}
	}
	for _, name := range timeArgs {
		if at, ok := meta[name].(string); ok {
			if parsed, err := time.Parse(time.RFC3339, at); err == nil {
				args[name] = parsed.In(siteZone).Format(timeLayout)
			}
		}
	}
	args[gameTitleArg] = gameTitle(ctx, meta)
	return args
}

func valueLabel(ctx context.Context, resp *response.Builder, prefixes []string, code string) string {
	for _, prefix := range prefixes {
		if label := resp.Translate(ctx, prefix+code, nil); label != prefix+code {
			return label
		}
	}
	return code
}

func gameTitle(ctx context.Context, meta map[string]any) string {
	locale, ok := i18n.FromContext(ctx)
	if !ok {
		locale = i18n.LocaleZH
	}
	for _, name := range gameTitleArgs[locale] {
		if title, ok := meta[name].(string); ok && strings.TrimSpace(title) != "" {
			return title
		}
	}
	return ""
}

func excerpt(content string) string {
	flat := strings.Join(strings.Fields(content), " ")
	runes := []rune(flat)
	if len(runes) <= excerptRunes {
		return flat
	}
	return string(runes[:excerptRunes]) + excerptSuffix
}
