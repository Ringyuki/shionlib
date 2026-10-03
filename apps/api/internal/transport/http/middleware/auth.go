package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reqstate"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const AccessTokenCookie = "shionlib_access_token"

type Authenticator interface {
	Authenticate(ctx context.Context, token string) (actor.Actor, error)
}

type AuthResult struct {
	Provided bool
	Err      error
}

type authResultKey struct{}

func AuthResultFrom(ctx context.Context) AuthResult {
	result, _ := ctx.Value(authResultKey{}).(AuthResult)
	return result
}

func Authenticate(authenticator Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			token := ExtractAccessToken(r)
			result := AuthResult{Provided: token != ""}
			who := actor.Guest()
			if result.Provided {
				authenticated, err := authenticator.Authenticate(ctx, token)
				if err != nil {
					result.Err = err
					ctx = response.WithStaleToken(ctx, staleReason(err))
				} else {
					who = authenticated
					reqstate.RecordUser(ctx, who.UserID)
				}
			}
			ctx = actor.With(ctx, who)
			ctx = context.WithValue(ctx, authResultKey{}, result)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireAuthenticated(ctx context.Context) error {
	result := AuthResultFrom(ctx)
	if !result.Provided {
		return auth.ErrUnauthorized
	}
	if result.Err != nil {
		if _, ok := apperror.From(result.Err); ok {
			return result.Err
		}
		return auth.ErrUnauthorized.Wrap(result.Err)
	}
	return nil
}

func ExtractAccessToken(r *http.Request) string {
	if token := bearerToken(r.Header.Get("Authorization")); token != "" {
		return token
	}
	if cookie, err := r.Cookie(AccessTokenCookie); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	return ""
}

func bearerToken(header string) string {
	scheme, token, found := strings.Cut(strings.TrimSpace(header), " ")
	if !found || scheme != "Bearer" {
		return ""
	}
	token = strings.TrimSpace(token)
	if token == "" || token == "undefined" || token == "null" {
		return ""
	}
	return token
}

func staleReason(err error) string {
	switch {
	case errors.Is(err, auth.ErrFamilyBlocked):
		return "family_blocked"
	case errors.Is(err, auth.ErrTokenExpired):
		return "TokenExpiredError"
	default:
		return "JsonWebTokenError"
	}
}
