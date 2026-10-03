package auth_test

import (
	"context"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var refreshFormat = regexp.MustCompile(`^slrt1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{43}$`)

func TestIssueCreatesAnActiveSessionAndSignsClaims(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	tokens, err := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{IP: "198.51.100.1", UserAgent: "test"})
	if err != nil {
		t.Fatal(err)
	}
	if !refreshFormat.MatchString(tokens.RefreshToken) {
		t.Fatalf("refresh token has the wrong wire format: %s", tokens.RefreshToken)
	}
	if !tokens.AccessExpiresAt.Equal(f.clock.Now().Add(time.Hour)) || !tokens.RefreshExpiresAt.Equal(f.clock.Now().Add(7*24*time.Hour)) {
		t.Fatalf("unexpected expiries %+v", tokens)
	}
	want := "access:" + strconv.Itoa(alice.ID) + ":" + strconv.Itoa(tokens.SessionID) + ":" + tokens.FamilyID + ":1:2:"
	if !strings.HasPrefix(tokens.AccessToken, want) {
		t.Fatalf("claims %s do not start with %s", tokens.AccessToken, want)
	}
	session, _, ok := f.repo.Session(tokens.SessionID)
	if !ok || session.Status != auth.SessionActive || session.UserID != alice.ID || session.RefreshHash != "hash:"+strings.Split(tokens.RefreshToken, ".")[2]+"pepper" {
		t.Fatalf("unexpected stored session %+v", session)
	}
}

func TestRefreshRotatesAndReplaysWithinGrace(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	issued, err := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	if err != nil {
		t.Fatal(err)
	}
	limit := actor.ContentLimitJustShow
	if err := f.users.Update(ctx, alice.ID, user.Changes{ContentLimit: &limit}); err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(time.Minute)
	rotated, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{IP: "198.51.100.2"})
	if err != nil {
		t.Fatal(err)
	}
	if rotated.FamilyID != issued.FamilyID || rotated.SessionID == issued.SessionID || rotated.RefreshToken == issued.RefreshToken {
		t.Fatalf("rotation must keep the family and issue a new pair: %+v", rotated)
	}
	if !strings.Contains(rotated.AccessToken, ":1:3:") {
		t.Fatalf("claims must be reloaded from the account: %s", rotated.AccessToken)
	}
	old, _, _ := f.repo.Session(issued.SessionID)
	if old.Status != auth.SessionRotated {
		t.Fatalf("old session status %d", old.Status)
	}
	replayed, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{})
	if err != nil {
		t.Fatal(err)
	}
	if replayed != rotated {
		t.Fatalf("idempotent replay must return the same pair:\n%+v\n%+v", replayed, rotated)
	}
	if len(f.repo.Sessions()) != 2 {
		t.Fatalf("replay must not create sessions: %d", len(f.repo.Sessions()))
	}
}

func TestRefreshKeepsTheFamilyHardCap(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	start := f.clock.Now()
	current := issued
	for range 4 {
		f.clock.Advance(6 * 24 * time.Hour)
		next, err := f.sessions.Refresh(ctx, current.RefreshToken, auth.Device{})
		if err != nil {
			t.Fatal(err)
		}
		current = next
	}
	if !current.RefreshExpiresAt.Equal(start.Add(30 * 24 * time.Hour)) {
		t.Fatalf("expiry must be capped by the family start: %v", current.RefreshExpiresAt)
	}
}

func TestRefreshReuseBlocksTheFamily(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	rotated, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{})
	if err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(101 * time.Second)
	if _, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{}); !errors.Is(err, auth.ErrRefreshTokenReused) {
		t.Fatalf("reuse after the grace window: %v", err)
	}
	old, _, _ := f.repo.Session(issued.SessionID)
	newer, reason, _ := f.repo.Session(rotated.SessionID)
	if old.Status != auth.SessionReused || newer.Status != auth.SessionBlocked || reason != "refresh_token_reuse_detected" {
		t.Fatalf("unexpected statuses old=%d newer=%d reason=%s", old.Status, newer.Status, reason)
	}
	ttl, blocked := f.families.TTL(issued.FamilyID)
	if !blocked || ttl < time.Hour {
		t.Fatalf("family must be blocked for at least the access token lifetime: %v %v", blocked, ttl)
	}
	if _, err := f.sessions.Refresh(ctx, rotated.RefreshToken, auth.Device{}); !errors.Is(err, auth.ErrFamilyBlocked) {
		t.Fatalf("blocked sessions: %v", err)
	}
	if _, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{}); !errors.Is(err, auth.ErrRefreshTokenReused) {
		t.Fatalf("repeated reuse: %v", err)
	}
}

func TestRefreshRejections(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	parts := strings.Split(issued.RefreshToken, ".")
	cases := map[string]string{
		"empty":         "",
		"wrong version": "slrt2." + parts[1] + "." + parts[2],
		"two parts":     "slrt1." + parts[1],
		"empty prefix":  "slrt1.." + parts[2],
		"unknown":       "slrt1.AAAAAAAAAAAAAAAA." + parts[2],
		"wrong secret":  "slrt1." + parts[1] + ".tampered",
	}
	for name, raw := range cases {
		if _, err := f.sessions.Refresh(ctx, raw, auth.Device{}); !errors.Is(err, auth.ErrInvalidRefreshToken) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	f.clock.Advance(8 * 24 * time.Hour)
	if _, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{}); !errors.Is(err, auth.ErrRefreshTokenExpired) {
		t.Fatalf("expired: %v", err)
	}
}

func TestRefreshBlocksFamiliesOfMissingOrBannedUsers(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	banned := f.seedUser()
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(banned), auth.Device{})
	status := user.StatusBanned
	if err := f.users.Update(ctx, banned.ID, user.Changes{Status: &status}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{}); !errors.Is(err, user.ErrBanned) {
		t.Fatalf("banned: %v", err)
	}
	session, reason, _ := f.repo.Session(issued.SessionID)
	if session.Status != auth.SessionBlocked || reason != "user_banned" {
		t.Fatalf("banned family must be blocked: %+v %s", session, reason)
	}
	if _, blocked := f.families.TTL(issued.FamilyID); !blocked {
		t.Fatal("family block missing")
	}

	ghost, _ := f.sessions.Issue(ctx, auth.Principal{UserID: 9999, Role: actor.RoleUser}, auth.Device{})
	if _, err := f.sessions.Refresh(ctx, ghost.RefreshToken, auth.Device{}); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
	if _, reason, _ := f.repo.Session(ghost.SessionID); reason != "user_not_found" {
		t.Fatalf("missing user reason %s", reason)
	}
}

func TestRefreshWaitsForAConcurrentRotation(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	if err := f.repo.MarkSessionRotated(ctx, issued.SessionID, issued.SessionID, f.clock.Now()); err != nil {
		t.Fatal(err)
	}
	other, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	done := make(chan struct{})
	go func() {
		defer close(done)
		time.Sleep(15 * time.Millisecond)
		raw := []byte(`{"access_token":"late","access_expires_at":"2026-10-03T01:00:00Z","refresh_token":"` + other.RefreshToken + `","refresh_expires_at":"2026-10-10T00:00:00Z","session_id":` + strconv.Itoa(other.SessionID) + `,"family_id":"` + issued.FamilyID + `"}`)
		_ = f.store.Put(ctx, "refresh:replay:"+strconv.Itoa(issued.SessionID), raw, time.Minute)
	}()
	replayed, err := f.sessions.Refresh(ctx, issued.RefreshToken, auth.Device{})
	<-done
	if err != nil {
		t.Fatal(err)
	}
	if replayed.AccessToken != "late" || replayed.SessionID != other.SessionID {
		t.Fatalf("the rotation result written while waiting must be returned: %+v", replayed)
	}
}

func TestLogoutBlocksTheFamily(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	if err := f.sessions.Logout(ctx, ""); err != nil {
		t.Fatalf("logout without a cookie is a no-op: %v", err)
	}
	if err := f.sessions.Logout(ctx, "garbage"); !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("malformed token: %v", err)
	}
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	parts := strings.Split(issued.RefreshToken, ".")
	if err := f.sessions.Logout(ctx, "slrt1."+parts[1]+".forged"); !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("logout must verify the secret: %v", err)
	}
	if err := f.sessions.Logout(ctx, issued.RefreshToken); err != nil {
		t.Fatal(err)
	}
	session, reason, _ := f.repo.Session(issued.SessionID)
	if session.Status != auth.SessionBlocked || reason != "user_logout" {
		t.Fatalf("logout must block the family: %+v %s", session, reason)
	}
	if _, blocked := f.families.TTL(issued.FamilyID); !blocked {
		t.Fatal("family block missing after logout")
	}
}

func TestRevokeUserBlocksLiveFamilies(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	stale, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	f.clock.Advance(2 * time.Hour)
	live, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	if err := f.sessions.RevokeUser(ctx, alice.ID, "user_password_changed"); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int{stale.SessionID, live.SessionID} {
		if session, reason, _ := f.repo.Session(id); session.Status != auth.SessionBlocked || reason != "user_password_changed" {
			t.Fatalf("session %d not blocked: %+v %s", id, session, reason)
		}
	}
	if _, blocked := f.families.TTL(live.FamilyID); !blocked {
		t.Fatal("live family must be blocked")
	}
	if _, blocked := f.families.TTL(stale.FamilyID); blocked {
		t.Fatal("families whose access tokens expired need no block")
	}
}

func TestCleanupStaleRemovesOldInactiveSessions(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	kept, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	if err := f.sessions.Logout(ctx, issued.RefreshToken); err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(15 * 24 * time.Hour)
	if err := f.sessions.CleanupStale(ctx); err != nil {
		t.Fatal(err)
	}
	if _, _, ok := f.repo.Session(issued.SessionID); ok {
		t.Fatal("stale blocked session was not removed")
	}
	if _, _, ok := f.repo.Session(kept.SessionID); !ok {
		t.Fatal("active sessions are never removed")
	}
}
