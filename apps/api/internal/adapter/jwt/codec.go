package jwt

import (
	"errors"
	"fmt"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

type claims struct {
	Sub          int    `json:"sub"`
	Sid          int    `json:"sid"`
	Fid          string `json:"fid"`
	Role         int    `json:"role"`
	ContentLimit int    `json:"content_limit"`
	Type         string `json:"type"`
	Iat          int64  `json:"iat"`
	Exp          int64  `json:"exp"`
}

func (c claims) GetExpirationTime() (*gojwt.NumericDate, error) {
	return gojwt.NewNumericDate(time.Unix(c.Exp, 0)), nil
}

func (c claims) GetIssuedAt() (*gojwt.NumericDate, error) {
	return gojwt.NewNumericDate(time.Unix(c.Iat, 0)), nil
}

func (c claims) GetNotBefore() (*gojwt.NumericDate, error) {
	return nil, nil
}

func (c claims) GetIssuer() (string, error) {
	return "", nil
}

func (c claims) GetSubject() (string, error) {
	return fmt.Sprint(c.Sub), nil
}

func (c claims) GetAudience() (gojwt.ClaimStrings, error) {
	return nil, nil
}

type Codec struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewCodec(secret string, ttl time.Duration, now func() time.Time) *Codec {
	return &Codec{secret: []byte(secret), ttl: ttl, now: now}
}

func (c *Codec) Sign(in auth.AccessClaims) (string, error) {
	issued := in.IssuedAt
	if issued.IsZero() {
		issued = c.now()
	}
	expires := in.ExpiresAt
	if expires.IsZero() {
		expires = issued.Add(c.ttl)
	}
	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims{
		Sub:          in.UserID,
		Sid:          in.SessionID,
		Fid:          in.FamilyID,
		Role:         int(in.Role),
		ContentLimit: int(in.ContentLimit),
		Type:         auth.TokenTypeAccess,
		Iat:          issued.Unix(),
		Exp:          expires.Unix(),
	})
	signed, err := token.SignedString(c.secret)
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return signed, nil
}

func (c *Codec) Verify(raw string) (auth.AccessClaims, error) {
	var parsed claims
	_, err := gojwt.ParseWithClaims(raw, &parsed, func(token *gojwt.Token) (any, error) {
		return c.secret, nil
	}, gojwt.WithValidMethods([]string{gojwt.SigningMethodHS256.Alg()}), gojwt.WithTimeFunc(c.now), gojwt.WithExpirationRequired())
	if err != nil {
		if errors.Is(err, gojwt.ErrTokenExpired) {
			return auth.AccessClaims{}, errors.Join(auth.ErrTokenExpired, err)
		}
		return auth.AccessClaims{}, fmt.Errorf("verify access token: %w", err)
	}
	if parsed.Type != auth.TokenTypeAccess {
		return auth.AccessClaims{}, errors.New("verify access token: unexpected token type")
	}
	return auth.AccessClaims{
		UserID:       parsed.Sub,
		SessionID:    parsed.Sid,
		FamilyID:     parsed.Fid,
		Role:         actor.Role(parsed.Role),
		ContentLimit: actor.ContentLimit(parsed.ContentLimit),
		IssuedAt:     time.Unix(parsed.Iat, 0).UTC(),
		ExpiresAt:    time.Unix(parsed.Exp, 0).UTC(),
	}, nil
}
