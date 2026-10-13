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
	standings Standings
}

func NewAuthenticationService(codec AccessTokenCodec, blocklist FamilyBlocklist, standings Standings) *AuthenticationService {
	return &AuthenticationService{codec: codec, blocklist: blocklist, standings: standings}
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
	standing, found, err := a.standings.Standing(ctx, claims.UserID)
	if err != nil {
		return actor.Guest(), fmt.Errorf("read standing of user %d: %w", claims.UserID, err)
	}
	if !found {
		return actor.Guest(), ErrUnauthorized.Wrap(errors.New("access token subject no longer exists"))
	}
	return actor.Actor{
		UserID:       claims.UserID,
		SessionID:    claims.SessionID,
		FamilyID:     claims.FamilyID,
		Role:         standing.Role,
		ContentLimit: standing.ContentLimit,
	}, nil
}
