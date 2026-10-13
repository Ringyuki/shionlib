package authredis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type Store struct {
	client *redis.Client
}

func NewStore(client *redis.Client) *Store {
	return &Store{client: client}
}

func (s *Store) SaveVerificationCode(ctx context.Context, id string, code auth.VerificationCode, ttl time.Duration) error {
	return s.put(ctx, verificationKey(id, code.Email), toVerificationCodeRecord(code), ttl)
}

func (s *Store) FindVerificationCode(ctx context.Context, id, email string) (auth.VerificationCode, bool, error) {
	var record verificationCodeRecord
	found, err := s.get(ctx, verificationKey(id, email), &record)
	return record.toVerificationCode(), found, err
}

func (s *Store) TakeVerificationCode(ctx context.Context, id, email string) (auth.VerificationCode, bool, error) {
	var record verificationCodeRecord
	found, err := s.take(ctx, verificationKey(id, email), &record)
	return record.toVerificationCode(), found, err
}

func (s *Store) SavePasswordReset(ctx context.Context, reset auth.PasswordReset, ttl time.Duration) error {
	return s.put(ctx, passwordResetKey(reset.Token, reset.Email), passwordResetRecord(reset), ttl)
}

func (s *Store) FindPasswordReset(ctx context.Context, token, email string) (auth.PasswordReset, bool, error) {
	var record passwordResetRecord
	found, err := s.get(ctx, passwordResetKey(token, email), &record)
	return auth.PasswordReset(record), found, err
}

func (s *Store) TakePasswordReset(ctx context.Context, token, email string) (auth.PasswordReset, bool, error) {
	var record passwordResetRecord
	found, err := s.take(ctx, passwordResetKey(token, email), &record)
	return auth.PasswordReset(record), found, err
}

func (s *Store) SavePasskeyChallenge(ctx context.Context, flowID string, challenge auth.PendingPasskeyChallenge, ttl time.Duration) error {
	return s.put(ctx, passkeyChallengeKey(flowID), passkeyChallengeRecord(challenge), ttl)
}

func (s *Store) TakePasskeyChallenge(ctx context.Context, flowID string) (auth.PendingPasskeyChallenge, bool, error) {
	var record passkeyChallengeRecord
	found, err := s.take(ctx, passkeyChallengeKey(flowID), &record)
	return auth.PendingPasskeyChallenge(record), found, err
}

func (s *Store) SaveRefreshReplay(ctx context.Context, sessionID int, tokens auth.Tokens, ttl time.Duration) error {
	return s.put(ctx, refreshReplayKey(sessionID), toRefreshReplayRecord(tokens), ttl)
}

func (s *Store) FindRefreshReplay(ctx context.Context, sessionID int) (auth.Tokens, bool, error) {
	var record refreshReplayRecord
	found, err := s.get(ctx, refreshReplayKey(sessionID), &record)
	return record.toTokens(), found, err
}

func (s *Store) put(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("encode auth state %s: %w", key, err)
	}
	if ttl < time.Millisecond {
		ttl = time.Millisecond
	}
	if err := s.client.Set(ctx, s.client.Key("auth", key), raw, ttl).Err(); err != nil {
		return fmt.Errorf("store auth state: %w", err)
	}
	return nil
}

func (s *Store) get(ctx context.Context, key string, into any) (bool, error) {
	return decode(s.client.Get(ctx, s.client.Key("auth", key)), key, into)
}

func (s *Store) take(ctx context.Context, key string, into any) (bool, error) {
	return decode(s.client.GetDel(ctx, s.client.Key("auth", key)), key, into)
}

func decode(cmd *goredis.StringCmd, key string, into any) (bool, error) {
	raw, err := cmd.Bytes()
	switch {
	case errors.Is(err, goredis.Nil):
		return false, nil
	case err != nil:
		return false, fmt.Errorf("read auth state: %w", err)
	}
	if err := json.Unmarshal(raw, into); err != nil {
		return false, fmt.Errorf("decode auth state %s: %w", key, err)
	}
	return true, nil
}

func verificationKey(id, email string) string {
	return "verification:" + id + ":" + email
}

func passwordResetKey(token, email string) string {
	return "password-reset:" + token + ":" + email
}

func passkeyChallengeKey(flowID string) string {
	return "passkey:challenge:" + flowID
}

func refreshReplayKey(sessionID int) string {
	return "refresh:replay:" + strconv.Itoa(sessionID)
}
