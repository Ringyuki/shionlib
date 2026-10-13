package requestid

import (
	"context"
	"crypto/rand"
	"fmt"
	"regexp"
)

const Header = "Shionlib-Request-Id"

var acceptable = regexp.MustCompile(`^[A-Za-z0-9._:-]{8,128}$`)

type contextKey struct{}

func New() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(fmt.Sprintf("requestid: crypto/rand failed: %v", err))
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func Acceptable(id string) bool {
	return acceptable.MatchString(id)
}

func With(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, contextKey{}, id)
}

func From(ctx context.Context) string {
	id, _ := ctx.Value(contextKey{}).(string)
	return id
}
