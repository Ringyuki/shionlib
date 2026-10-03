package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

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

type SessionService struct {
	repo     SessionRepository
	accounts Accounts
	codec    AccessTokenCodec
	hasher   SecretHasher
	families FamilyBlocklist
	replays  RefreshReplayStore
	tx       Transactor
	now      func() time.Time
	policy   SessionPolicy
}

func NewSessionService(repo SessionRepository, accounts Accounts, codec AccessTokenCodec, hasher SecretHasher, families FamilyBlocklist, replays RefreshReplayStore, tx Transactor, now func() time.Time, policy SessionPolicy) *SessionService {
	if policy.ReplayPoll <= 0 {
		policy.ReplayPoll = DefaultReplayPoll
	}
	return &SessionService{repo: repo, accounts: accounts, codec: codec, hasher: hasher, families: families, replays: replays, tx: tx, now: now, policy: policy}
}

func (s *SessionService) Issue(ctx context.Context, who Principal, device Device) (Tokens, error) {
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

func (s *SessionService) Refresh(ctx context.Context, raw string, device Device) (Tokens, error) {
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

func (s *SessionService) Logout(ctx context.Context, raw string) error {
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

func (s *SessionService) RevokeUser(ctx context.Context, userID int, reason string) error {
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

func (s *SessionService) CleanupStale(ctx context.Context) error {
	_, err := s.repo.DeleteStaleSessions(ctx, s.now().Add(-SessionRetention))
	return err
}

func (s *SessionService) rotate(ctx context.Context, old Session, who Principal, device Device, now time.Time) (Tokens, error) {
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

func (s *SessionService) verifiedSession(ctx context.Context, presented refreshToken, lock bool) (Session, error) {
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

func (s *SessionService) blockFamily(ctx context.Context, session Session, statuses []SessionStatus, reason string, now time.Time) error {
	if err := s.repo.BlockFamily(ctx, session.FamilyID, statuses, reason, now); err != nil {
		return err
	}
	return s.families.Block(ctx, session.FamilyID, s.familyBlockTTL(session.ExpiresAt, now))
}

func (s *SessionService) familyBlockTTL(expiresAt, now time.Time) time.Duration {
	return max(expiresAt.Sub(now), s.policy.AccessTTL, minFamilyBlockTTL)
}

func (s *SessionService) refreshExpiry(first, now time.Time) time.Time {
	short := now.Add(s.policy.ShortWindow)
	hard := first.Add(s.policy.LongWindow)
	if short.Before(hard) {
		return short
	}
	return hard
}

func (s *SessionService) newSecret() (refreshToken, string, error) {
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

func (s *SessionService) sign(who Principal, sessionID int, familyID string, token refreshToken, refreshExpires, now time.Time) (Tokens, error) {
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

func (s *SessionService) saveReplay(ctx context.Context, oldSessionID int, tokens Tokens) error {
	if s.policy.RotationGrace <= 0 {
		return nil
	}
	return s.replays.SaveRefreshReplay(ctx, oldSessionID, tokens, s.policy.RotationGrace)
}

func (s *SessionService) awaitReplay(ctx context.Context, oldSessionID int) (Tokens, bool, error) {
	var waited time.Duration
	for {
		tokens, found, err := s.replays.FindRefreshReplay(ctx, oldSessionID)
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
