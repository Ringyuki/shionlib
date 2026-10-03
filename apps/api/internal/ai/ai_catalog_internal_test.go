package ai

import "testing"

func TestModelIDsNormalizeAcrossProviders(t *testing.T) {
	for input, want := range map[string]string{
		"openai/GPT-4.1-mini":      "gpt-4-1-mini",
		"claude-sonnet-4-20250514": "claude-sonnet-4",
		"models/gemini-2.5-pro":    "gemini-2-5-pro",
		"qwen3:latest":             "qwen3",
		"deepseek_chat-2025-01-20": "deepseek-chat",
		"vendor/model-name-latest": "model-name",
	} {
		if got := normalizeModelID(input); got != want {
			t.Fatalf("%q: %q want %q", input, got, want)
		}
	}
}

func TestCatalogIndexPrefersTheLab(t *testing.T) {
	relay, canonical := "relay", "anthropic/claude-sonnet-4"
	npm := "@ai-sdk/anthropic"
	index := NewCatalogIndex(Catalog{
		Providers: []CatalogProvider{{ID: "anthropic", NPM: &npm}, {ID: "relay", APIURL: &relay}},
		Models: []CatalogModel{
			{ProviderID: "relay", ModelKey: "claude-4-sonnet", CanonicalID: &canonical, Name: "Relay Claude"},
			{ProviderID: "anthropic", ModelKey: "claude-sonnet-4-20250514", CanonicalID: &canonical, Name: "Claude Sonnet 4"},
		},
	})
	if official, ok := index.Official(canonical); !ok || official.Name != "Claude Sonnet 4" {
		t.Fatalf("official %+v", official)
	}
	if found, ok := index.CanonicalOf("claude-sonnet-4"); !ok || found != canonical {
		t.Fatalf("loose match %q %v", found, ok)
	}
	if exact, ok := index.Exact(&relay, "claude-4-sonnet"); !ok || exact.Name != "Relay Claude" {
		t.Fatalf("exact %+v", exact)
	}
	if index.NativeProtocol(canonical) != ProtocolMessages || index.NativeProtocol("relay/x") != ProtocolChat {
		t.Fatal("native protocols")
	}
}
