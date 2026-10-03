package argon2hash

import (
	"strings"
	"testing"
)

func TestVerifiesHashesProducedByNodeArgon2(t *testing.T) {
	cases := []struct {
		hash   string
		secret string
	}{
		{"$argon2id$v=19$m=65536,t=3,p=4$KEHheGq0MiqkJYyK5z/LWQ$wYI4dqqkRLQTlU1aZOeNBUaHwv0bUc1TCbmDsdA28H0", "Secret123"},
		{"$argon2id$v=19$m=19456,t=2,p=1$hG6viVC9z5SH/C6zr4hjCA$IA0IQayX6HKVOD+cyb1vJ+vohbubWKgWVM5iFP4ljX0", "opaque-valuepepper"},
		{"$argon2i$v=19$m=65536,t=3,p=4$Mofd5Ra+45hGYoCd+i/Zxw$HOQjabFymrLYNyoBEva860KU508z4R7TSQ9NzDosboI", "Secret123"},
	}
	hasher := New(PasswordParams())
	for _, tc := range cases {
		ok, err := hasher.Verify(tc.hash, tc.secret)
		if err != nil || !ok {
			t.Fatalf("legacy hash %s must verify: %v %v", tc.hash, ok, err)
		}
		if ok, err := hasher.Verify(tc.hash, tc.secret+"x"); err != nil || ok {
			t.Fatalf("wrong secret must fail: %v %v", ok, err)
		}
	}
}

func TestHashUsesTheLegacyParameters(t *testing.T) {
	for _, tc := range []struct {
		params Params
		prefix string
	}{
		{PasswordParams(), "$argon2id$v=19$m=65536,t=3,p=4$"},
		{RefreshTokenParams(), "$argon2id$v=19$m=19456,t=2,p=1$"},
	} {
		hasher := New(tc.params)
		hash, err := hasher.Hash("secret")
		if err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(hash, tc.prefix) || len(strings.Split(hash, "$")[4]) != 22 || len(strings.Split(hash, "$")[5]) != 43 {
			t.Fatalf("unexpected PHC string %s", hash)
		}
		if ok, err := hasher.Verify(hash, "secret"); err != nil || !ok {
			t.Fatalf("round trip: %v %v", ok, err)
		}
	}
}

func TestRejectsMalformedHashes(t *testing.T) {
	hasher := New(PasswordParams())
	for _, hash := range []string{
		"",
		"plain",
		"$argon2d$v=19$m=65536,t=3,p=4$KEHheGq0MiqkJYyK5z/LWQ$wYI4dqqkRLQTlU1aZOeNBUaHwv0bUc1TCbmDsdA28H0",
		"$argon2id$v=16$m=65536,t=3,p=4$KEHheGq0MiqkJYyK5z/LWQ$wYI4dqqkRLQTlU1aZOeNBUaHwv0bUc1TCbmDsdA28H0",
		"$argon2id$v=19$m=x,t=3,p=4$KEHheGq0MiqkJYyK5z/LWQ$wYI4dqqkRLQTlU1aZOeNBUaHwv0bUc1TCbmDsdA28H0",
		"$argon2id$v=19$m=65536,t=3$KEHheGq0MiqkJYyK5z/LWQ$wYI4dqqkRLQTlU1aZOeNBUaHwv0bUc1TCbmDsdA28H0",
		"$argon2id$v=19$m=65536,t=3,p=4$!!$wYI4dqqkRLQTlU1aZOeNBUaHwv0bUc1TCbmDsdA28H0",
	} {
		if _, err := hasher.Verify(hash, "Secret123"); err == nil {
			t.Fatalf("expected an error for %q", hash)
		}
	}
}
