package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	DefaultReplayWait = 1200 * time.Millisecond
	DefaultReplayPoll = 20 * time.Millisecond
	SessionRetention  = 7 * 24 * time.Hour
	minFamilyBlockTTL = time.Second
)

type SessionPolicy struct {
	Version       string
	Pepper        string
	AccessTTL     time.Duration
	ShortWindow   time.Duration
	LongWindow    time.Duration
	RotationGrace time.Duration
	ReplayWait    time.Duration
	ReplayPoll    time.Duration
}

type Sessions struct {
	repo     SessionRepository
	accounts Accounts
	codec    AccessTokenCodec
	hasher   SecretHasher
	families FamilyBlocklist
	store    EphemeralStore
	tx       Transactor
	now      func() time.Time
	policy   SessionPolicy
}

func NewSessions(repo SessionRepository, accounts Accounts, codec AccessTokenCodec, hasher SecretHasher, families FamilyBlocklist, store EphemeralStore, tx Transactor, now func() time.Time, policy SessionPolicy) *Sessions {
	if policy.ReplayPoll <= 0 {
		policy.ReplayPoll = DefaultReplayPoll
	}
	return &Sessions{repo: repo, accounts: accounts, codec: codec, hasher: hasher, families: families, store: store, tx: tx, now: now, policy: policy}
}

func (s *Sessions) Issue(ctx context.Context, who Principal, device Device) (Tokens, error) {
	now := s.now()
	token, hash, err := s.newSecret()
	if err != nil {
		return Tokens{}, err
	}
	familyID := uuid.NewString()
	expires := s.refreshExpiry(now, now)
	session, err := s.repo.CreateSession(ctx, NewSession{
		UserID:      who.UserID,
		RefreshHash: hash,
		Prefix:      token.prefix,
		FamilyID:    familyID,
		ExpiresAt:   expires,
		LastUsedAt:  now,
		IP:          optional(device.IP),
		UserAgent:   optional(device.UserAgent),
	})
	if err != nil {
		return Tokens{}, err
	}
	return s.sign(who, session.ID, familyID, token, expires, now)
}

func (s *Sessions) Refresh(ctx context.Context, raw string, device Device) (Tokens, error) {
	if raw == "" {
		return Tokens{}, ErrInvalidRefreshToken
	}
	presented, err := parseRefreshToken(raw, s.policy.Version)
	if err != nil {
		return Tokens{}, err
	}
	var (
		result  Tokens
		outcome error
	)
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		result, outcome = Tokens{}, nil
		old, err := s.verifiedSession(ctx, presented, true)
		if err != nil {
			return err
		}
		now := s.now()
		if !old.ExpiresAt.After(now) {
			return ErrRefreshTokenExpired
		}
		switch old.Status {
		case SessionActive:
		case SessionBlocked:
			return ErrFamilyBlocked
		default:
			if old.Status == SessionRotated {
				replayed, found, err := s.awaitReplay(ctx, old.ID)
				if err != nil {
					return err
				}
				if found {
					result = replayed
					return nil
				}
			}
			if old.Status != SessionReused {
				if err := s.repo.MarkSessionReused(ctx, old.ID, now); err != nil {
					return err
				}
			}
			outcome = ErrRefreshTokenReused
			return s.blockFamily(ctx, old, []SessionStatus{SessionActive}, reasonReuseDetected, now)
		}
		account, err := s.accounts.Get(ctx, old.UserID)
		switch {
		case errors.Is(err, user.ErrNotFound):
			outcome = user.ErrNotFound
			return s.blockFamily(ctx, old, []SessionStatus{SessionActive, SessionRotated}, reasonUserNotFound, now)
		case err != nil:
			return err
		case account.Banned():
			outcome = user.ErrBanned
			return s.blockFamily(ctx, old, []SessionStatus{SessionActive, SessionRotated}, reasonUserBanned, now)
		}
		result, err = s.rotate(ctx, old, PrincipalOf(account), device, now)
		return err
	})
	if err != nil {
		return Tokens{}, err
	}
	if outcome != nil {
		return Tokens{}, outcome
	}
	return result, nil
}

func (s *Sessions) Logout(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	presented, err := parseRefreshToken(raw, s.policy.Version)
	if err != nil {
		return err
	}
	session, err := s.verifiedSession(ctx, presented, false)
	if err != nil {
		return err
	}
	now := s.now()
	if err := s.repo.BlockUserFamily(ctx, session.UserID, session.FamilyID, reasonLogout, now); err != nil {
		return err
	}
	return s.families.Block(ctx, session.FamilyID, s.familyBlockTTL(session.ExpiresAt, now))
}

func (s *Sessions) RevokeUser(ctx context.Context, userID int, reason string) error {
	now := s.now()
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		families, err := s.repo.BlockUserSessions(ctx, userID, reason, now, now.Add(-s.policy.AccessTTL))
		if err != nil {
			return err
		}
		for _, family := range families {
			if err := s.families.Block(ctx, family.FamilyID, s.familyBlockTTL(family.ExpiresAt, now)); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Sessions) CleanupStale(ctx context.Context) error {
	_, err := s.repo.DeleteStaleSessions(ctx, s.now().Add(-SessionRetention))
	return err
}

func (s *Sessions) rotate(ctx context.Context, old Session, who Principal, device Device, now time.Time) (Tokens, error) {
	started, found, err := s.repo.FamilyStartedAt(ctx, old.FamilyID)
	if err != nil {
		return Tokens{}, err
	}
	if !found {
		started = now
	}
	token, hash, err := s.newSecret()
	if err != nil {
		return Tokens{}, err
	}
	expires := s.refreshExpiry(started, now)
	newer, err := s.repo.CreateSession(ctx, NewSession{
		UserID:      old.UserID,
		RefreshHash: hash,
		Prefix:      token.prefix,
		FamilyID:    old.FamilyID,
		ExpiresAt:   expires,
		LastUsedAt:  now,
		IP:          optional(device.IP),
		UserAgent:   optional(device.UserAgent),
	})
	if err != nil {
		return Tokens{}, err
	}
	if err := s.repo.MarkSessionRotated(ctx, old.ID, newer.ID, now); err != nil {
		return Tokens{}, err
	}
	tokens, err := s.sign(who, newer.ID, old.FamilyID, token, expires, now)
	if err != nil {
		return Tokens{}, err
	}
	if err := s.saveReplay(ctx, old.ID, tokens); err != nil {
		return Tokens{}, err
	}
	return tokens, nil
}

func (s *Sessions) verifiedSession(ctx context.Context, presented refreshToken, lock bool) (Session, error) {
	find := s.repo.FindSessionByPrefix
	if lock {
		find = s.repo.LockSessionByPrefix
	}
	session, found, err := find(ctx, presented.prefix)
	if err != nil {
		return Session{}, err
	}
	if !found {
		return Session{}, ErrInvalidRefreshToken
	}
	ok, err := s.hasher.Verify(session.RefreshHash, presented.opaque+s.policy.Pepper)
	if err != nil {
		return Session{}, fmt.Errorf("verify refresh token: %w", err)
	}
	if !ok {
		return Session{}, ErrInvalidRefreshToken
	}
	return session, nil
}

func (s *Sessions) blockFamily(ctx context.Context, session Session, statuses []SessionStatus, reason string, now time.Time) error {
	if err := s.repo.BlockFamily(ctx, session.FamilyID, statuses, reason, now); err != nil {
		return err
	}
	return s.families.Block(ctx, session.FamilyID, s.familyBlockTTL(session.ExpiresAt, now))
}

func (s *Sessions) familyBlockTTL(expiresAt, now time.Time) time.Duration {
	return max(expiresAt.Sub(now), s.policy.AccessTTL, minFamilyBlockTTL)
}

func (s *Sessions) refreshExpiry(first, now time.Time) time.Time {
	short := now.Add(s.policy.ShortWindow)
	hard := first.Add(s.policy.LongWindow)
	if short.Before(hard) {
		return short
	}
	return hard
}

func (s *Sessions) newSecret() (refreshToken, string, error) {
	token, err := newRefreshToken()
	if err != nil {
		return refreshToken{}, "", err
	}
	hash, err := s.hasher.Hash(token.opaque + s.policy.Pepper)
	if err != nil {
		return refreshToken{}, "", fmt.Errorf("hash refresh token: %w", err)
	}
	return token, hash, nil
}

func (s *Sessions) sign(who Principal, sessionID int, familyID string, token refreshToken, refreshExpires, now time.Time) (Tokens, error) {
	accessExpires := now.Add(s.policy.AccessTTL).Truncate(time.Second)
	access, err := s.codec.Sign(AccessClaims{
		UserID:       who.UserID,
		SessionID:    sessionID,
		FamilyID:     familyID,
		Role:         who.Role,
		ContentLimit: who.ContentLimit,
		IssuedAt:     now,
		ExpiresAt:    accessExpires,
	})
	if err != nil {
		return Tokens{}, err
	}
	return Tokens{
		AccessToken:      access,
		AccessExpiresAt:  accessExpires,
		RefreshToken:     token.format(s.policy.Version),
		RefreshExpiresAt: refreshExpires,
		SessionID:        sessionID,
		FamilyID:         familyID,
	}, nil
}

type replayRecord struct {
	AccessToken      string    `json:"access_token"`
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshToken     string    `json:"refresh_token"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	SessionID        int       `json:"session_id"`
	FamilyID         string    `json:"family_id"`
}

func replayKey(sessionID int) string {
	return "refresh:replay:" + strconv.Itoa(sessionID)
}

func (s *Sessions) saveReplay(ctx context.Context, oldSessionID int, tokens Tokens) error {
	if s.policy.RotationGrace <= 0 {
		return nil
	}
	raw, err := json.Marshal(replayRecord(tokens))
	if err != nil {
		return fmt.Errorf("encode refresh replay: %w", err)
	}
	return s.store.Put(ctx, replayKey(oldSessionID), raw, s.policy.RotationGrace)
}

func (s *Sessions) loadReplay(ctx context.Context, oldSessionID int) (Tokens, bool, error) {
	raw, found, err := s.store.Get(ctx, replayKey(oldSessionID))
	if err != nil || !found {
		return Tokens{}, false, err
	}
	var record replayRecord
	if err := json.Unmarshal(raw, &record); err != nil {
		return Tokens{}, false, fmt.Errorf("decode refresh replay: %w", err)
	}
	return Tokens(record), true, nil
}

func (s *Sessions) awaitReplay(ctx context.Context, oldSessionID int) (Tokens, bool, error) {
	var waited time.Duration
	for {
		tokens, found, err := s.loadReplay(ctx, oldSessionID)
		if err != nil || found {
			return tokens, found, err
		}
		if waited >= s.policy.ReplayWait {
			return Tokens{}, false, nil
		}
		timer := time.NewTimer(s.policy.ReplayPoll)
		select {
		case <-ctx.Done():
			timer.Stop()
			return Tokens{}, false, ctx.Err()
		case <-timer.C:
		}
		waited += s.policy.ReplayPoll
	}
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
