package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type AuthenticationService struct {
	codec     AccessTokenCodec
	blocklist FamilyBlocklist
}

func NewAuthenticationService(codec AccessTokenCodec, blocklist FamilyBlocklist) *AuthenticationService {
	return &AuthenticationService{codec: codec, blocklist: blocklist}
}

func (a *AuthenticationService) Authenticate(ctx context.Context, token string) (actor.Actor, error) {
	claims, err := a.codec.Verify(token)
	if err != nil {
		return actor.Guest(), ErrUnauthorized.Wrap(err)
	}
	if claims.UserID <= 0 {
		return actor.Guest(), ErrUnauthorized.Wrap(errors.New("access token subject is not a user"))
	}
	blocked, err := a.blocklist.Blocked(ctx, claims.FamilyID)
	if err != nil {
		return actor.Guest(), fmt.Errorf("check session family: %w", err)
	}
	if blocked {
		return actor.Guest(), ErrFamilyBlocked
	}
	return actor.Actor{
		UserID:       claims.UserID,
		SessionID:    claims.SessionID,
		FamilyID:     claims.FamilyID,
		Role:         claims.Role,
		ContentLimit: claims.ContentLimit,
	}, nil
}
