package game

import (
	"strings"
	"time"
)

const (
	BangumiStateTTL          = 10 * time.Minute
	bangumiCallbackPath      = "/api/admin/bangumi/authorization/callback"
	bangumiDefaultReturnPath = "/"
)

type BangumiAuthorization struct {
	Configured  bool
	Authorized  bool
	ExpiresAt   *time.Time
	CallbackURL string
}

func bangumiReturnPath(raw string) string {
	if !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") || strings.ContainsAny(raw, "\\\r\n") {
		return bangumiDefaultReturnPath
	}
	return raw
}
