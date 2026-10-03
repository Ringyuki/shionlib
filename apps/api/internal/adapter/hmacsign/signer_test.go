package hmacsign_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/hmacsign"
)

func TestSignAndVerify(t *testing.T) {
	signer := hmacsign.New("a-long-server-secret", "sponsor-order-access")
	signature := signer.Sign("sponsor-order:1:idr-1")
	if len(signature) != 43 {
		t.Fatalf("expected a 256-bit url-safe signature, got %q", signature)
	}
	if !signer.Verify("sponsor-order:1:idr-1", signature) {
		t.Fatal("signature must verify")
	}
	for _, forged := range []string{"", "not base64!", signature[:42], signer.Sign("sponsor-order:2:idr-1")} {
		if signer.Verify("sponsor-order:1:idr-1", forged) {
			t.Fatalf("forged signature %q verified", forged)
		}
	}
	if hmacsign.New("a-long-server-secret", "other-purpose").Verify("sponsor-order:1:idr-1", signature) {
		t.Fatal("keys are separated by purpose")
	}
	if hmacsign.New("another-secret", "sponsor-order-access").Verify("sponsor-order:1:idr-1", signature) {
		t.Fatal("keys depend on the secret")
	}
}
