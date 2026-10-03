package keybox_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/keybox"
)

const secret = "0123456789abcdef0123456789abcdef"

func TestSealedValuesRoundTripAndHideThePlaintext(t *testing.T) {
	box, err := keybox.NewBox(secret)
	if err != nil {
		t.Fatal(err)
	}
	first, err := box.Seal("sk-live-secret")
	if err != nil {
		t.Fatal(err)
	}
	second, err := box.Seal("sk-live-secret")
	if err != nil {
		t.Fatal(err)
	}
	if first == second || strings.Contains(first, "sk-live") || !strings.HasPrefix(first, "v1:") {
		t.Fatalf("sealed values must be versioned, random and opaque: %q %q", first, second)
	}
	for _, sealed := range []string{first, second} {
		if plain, err := box.Open(sealed); err != nil || plain != "sk-live-secret" {
			t.Fatalf("open %q: %q %v", sealed, plain, err)
		}
	}
}

func TestShortSecretsAreRejected(t *testing.T) {
	if _, err := keybox.NewBox("short"); !errors.Is(err, keybox.ErrSecretTooShort) {
		t.Fatalf("unexpected error %v", err)
	}
}

func TestTamperedOrForeignValuesFailToOpen(t *testing.T) {
	box, err := keybox.NewBox(secret)
	if err != nil {
		t.Fatal(err)
	}
	other, err := keybox.NewBox(strings.Repeat("x", 40))
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := box.Seal("value")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := other.Open(sealed); err == nil {
		t.Fatal("a different secret must not open the value")
	}
	if _, err := box.Open("value"); !errors.Is(err, keybox.ErrMalformed) {
		t.Fatalf("unversioned value: %v", err)
	}
	if _, err := box.Open("v1:!!!"); !errors.Is(err, keybox.ErrMalformed) {
		t.Fatalf("bad base64: %v", err)
	}
	tampered := sealed[:len(sealed)-2] + "AA"
	if _, err := box.Open(tampered); err == nil {
		t.Fatal("tampered values must fail")
	}
}
