package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"
)

const (
	refreshOpaqueBytes = 32
	refreshPrefixChars = 16
)

type refreshToken struct {
	prefix string
	opaque string
}

func newRefreshToken() (refreshToken, error) {
	raw := make([]byte, refreshOpaqueBytes)
	if _, err := rand.Read(raw); err != nil {
		return refreshToken{}, fmt.Errorf("generate refresh token: %w", err)
	}
	opaque := base64.RawURLEncoding.EncodeToString(raw)
	return refreshToken{prefix: refreshPrefix(opaque), opaque: opaque}, nil
}

func refreshPrefix(opaque string) string {
	digest := sha256.Sum256([]byte(opaque))
	return base64.RawURLEncoding.EncodeToString(digest[:])[:refreshPrefixChars]
}

func parseRefreshToken(raw, version string) (refreshToken, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 3 || parts[0] != version || parts[1] == "" || parts[2] == "" {
		return refreshToken{}, ErrInvalidRefreshToken
	}
	return refreshToken{prefix: parts[1], opaque: parts[2]}, nil
}

func (t refreshToken) format(version string) string {
	return version + "." + t.prefix + "." + t.opaque
}
