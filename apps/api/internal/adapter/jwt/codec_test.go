package jwt

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

const secret = "test-secret-value"

func fixedNow() time.Time {
	return time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
}

func signLegacy(t *testing.T, payload string) string {
	t.Helper()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	body := base64.RawURLEncoding.EncodeToString([]byte(payload))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(header + "." + body))
	return header + "." + body + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestVerifyAcceptsTokensIssuedByLegacyBackend(t *testing.T) {
	codec := NewCodec(secret, time.Hour, fixedNow)
	iat := fixedNow().Add(-time.Minute).Unix()
	exp := fixedNow().Add(time.Hour).Unix()
	token := signLegacy(t, `{"sub":42,"sid":7,"fid":"2b3c-family","role":2,"content_limit":3,"type":"access","iat":`+itoa(iat)+`,"exp":`+itoa(exp)+`}`)
	claims, err := codec.Verify(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.UserID != 42 || claims.SessionID != 7 || claims.FamilyID != "2b3c-family" || claims.Role != actor.RoleAdmin || claims.ContentLimit != actor.ContentLimitJustShow {
		t.Fatalf("unexpected claims %+v", claims)
	}
}

func TestSignProducesLegacyCompatiblePayload(t *testing.T) {
	codec := NewCodec(secret, time.Hour, fixedNow)
	token, err := codec.Sign(auth.AccessClaims{UserID: 5, SessionID: 9, FamilyID: "fam", Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow})
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("token is not a JWT: %s", token)
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`"sub":5`, `"sid":9`, `"fid":"fam"`, `"role":1`, `"content_limit":1`, `"type":"access"`, `"exp":` + itoa(fixedNow().Add(time.Hour).Unix())} {
		if !strings.Contains(string(payload), want) {
			t.Fatalf("payload %s missing %s", payload, want)
		}
	}
	claims, err := codec.Verify(token)
	if err != nil {
		t.Fatal(err)
	}
	if !claims.ExpiresAt.Equal(fixedNow().Add(time.Hour)) {
		t.Fatalf("unexpected expiry %v", claims.ExpiresAt)
	}
}

func TestVerifyRejections(t *testing.T) {
	codec := NewCodec(secret, time.Hour, fixedNow)
	expired := signLegacy(t, `{"sub":1,"sid":1,"fid":"f","role":1,"content_limit":1,"type":"access","iat":1,"exp":`+itoa(fixedNow().Add(-time.Second).Unix())+`}`)
	if _, err := codec.Verify(expired); !errors.Is(err, auth.ErrTokenExpired) {
		t.Fatalf("expected expiry error, got %v", err)
	}
	wrongType := signLegacy(t, `{"sub":1,"sid":1,"fid":"f","role":1,"content_limit":1,"type":"refresh","iat":1,"exp":`+itoa(fixedNow().Add(time.Hour).Unix())+`}`)
	if _, err := codec.Verify(wrongType); err == nil {
		t.Fatal("expected wrong token type to be rejected")
	}
	noExp := signLegacy(t, `{"sub":1,"type":"access"}`)
	if _, err := codec.Verify(noExp); err == nil {
		t.Fatal("expected missing exp to be rejected")
	}
	other := NewCodec("another-secret-value", time.Hour, fixedNow)
	foreign, err := other.Sign(auth.AccessClaims{UserID: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := codec.Verify(foreign); err == nil {
		t.Fatal("expected signature mismatch to be rejected")
	}
	if _, err := codec.Verify("not-a-token"); err == nil {
		t.Fatal("expected garbage to be rejected")
	}
}

func itoa(v int64) string {
	return strconv.FormatInt(v, 10)
}
