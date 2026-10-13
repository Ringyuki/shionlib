package ai_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestKeyHintsNeverRevealShortKeys(t *testing.T) {
	if ai.KeyHint("short-key") != "…" || ai.KeyHint("sk-abcdefghijklmnop") != "sk-…mnop" {
		t.Fatal("hints")
	}
}

func TestProviderKindsFixTheirProtocols(t *testing.T) {
	if ai.KindAnthropic.ProtocolFor(ai.ProtocolChat, false) != ai.ProtocolMessages || ai.KindOpenAI.ProtocolFor(ai.ProtocolChat, true) != ai.ProtocolModeration || ai.KindCompatible.ProtocolFor(ai.ProtocolGemini, false) != ai.ProtocolGemini {
		t.Fatal("protocols")
	}
	if !ai.KindCompatible.RequiresBaseURL() || ai.KindGoogle.RequiresBaseURL() || ai.KindGoogle.Supports(ai.ProtocolModeration) {
		t.Fatal("kinds")
	}
}
