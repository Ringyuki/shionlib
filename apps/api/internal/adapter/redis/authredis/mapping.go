package authredis

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

type verificationCodeRecord struct {
	Email     string `json:"email"`
	Code      string `json:"code"`
	CreatedAt int64  `json:"createdAt"`
}

func toVerificationCodeRecord(code auth.VerificationCode) verificationCodeRecord {
	return verificationCodeRecord{Email: code.Email, Code: code.Code, CreatedAt: code.Created.UnixMilli()}
}

func (r verificationCodeRecord) toVerificationCode() auth.VerificationCode {
	return auth.VerificationCode{Email: r.Email, Code: r.Code, Created: time.UnixMilli(r.CreatedAt).UTC()}
}

type passwordResetRecord struct {
	Token string `json:"token"`
	Email string `json:"email"`
}

type passkeyChallengeRecord struct {
	Kind          string `json:"kind"`
	State         []byte `json:"state"`
	UserID        int    `json:"user_id,omitempty"`
	SuggestedName string `json:"suggested_name,omitempty"`
}

type refreshReplayRecord struct {
	Access         string    `json:"a"`
	AccessExpires  time.Time `json:"ae"`
	Refresh        string    `json:"r"`
	RefreshExpires time.Time `json:"re"`
	Session        int       `json:"s"`
	Family         string    `json:"f"`
}

func toRefreshReplayRecord(tokens auth.Tokens) refreshReplayRecord {
	return refreshReplayRecord{
		Access:         tokens.AccessToken,
		AccessExpires:  tokens.AccessExpiresAt,
		Refresh:        tokens.RefreshToken,
		RefreshExpires: tokens.RefreshExpiresAt,
		Session:        tokens.SessionID,
		Family:         tokens.FamilyID,
	}
}

func (r refreshReplayRecord) toTokens() auth.Tokens {
	return auth.Tokens{
		AccessToken:      r.Access,
		AccessExpiresAt:  r.AccessExpires,
		RefreshToken:     r.Refresh,
		RefreshExpiresAt: r.RefreshExpires,
		SessionID:        r.Session,
		FamilyID:         r.Family,
	}
}
