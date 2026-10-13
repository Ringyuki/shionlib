package ai

import "strings"

type ProviderInput struct {
	Name              string
	Kind              ProviderKind
	BaseURL           *string
	APIKey            string
	PriceMultiplier   *float64
	CatalogProviderID *string
}

type ProviderUpdate struct {
	Name              *string
	Kind              *ProviderKind
	BaseURL           **string
	APIKey            *string
	PriceMultiplier   *float64
	CatalogProviderID **string
	Enabled           *bool
}

func normalizeBaseURL(raw *string) *string {
	if raw == nil {
		return nil
	}
	trimmed := strings.TrimRight(strings.TrimSpace(*raw), "/")
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func KeyHint(key string) string {
	runes := []rune(key)
	if len(runes) <= 12 {
		return "…"
	}
	return string(runes[:3]) + "…" + string(runes[len(runes)-4:])
}
