package ai

import (
	"strconv"
	"strings"
)

type ModelInput struct {
	CanonicalID string
	Name        string
	Description *string
	Routes      []RouteSource
}

type RouteSource struct {
	ProviderID  int
	UpstreamID  string
	Protocol    Protocol
	PriceManual bool
	InputPrice  *float64
	OutputPrice *float64
}

type ModelUpdate struct {
	Name        *string
	Description **string
	CanonicalID **string
	Vision      *bool
	Enabled     *bool
	IsDefault   *bool
}

func modelKey(source string, taken map[string]bool) string {
	parts := strings.Split(source, "/")
	base := parts[len(parts)-1]
	key := base
	for suffix := 2; taken[key]; suffix++ {
		key = base + "-" + strconv.Itoa(suffix)
	}
	taken[key] = true
	return key
}

func describedPrice(described DiscoveredModel, found bool) Price {
	if !found {
		return Price{}
	}
	return Price{Input: valueOr(described.InputPrice, 0), Output: valueOr(described.OutputPrice, 0)}
}

func priced(provider Provider) pricedConnection {
	return pricedConnection{Kind: provider.Kind, CatalogProviderID: provider.CatalogProviderID, PriceMultiplier: provider.PriceMultiplier}
}

func sameString(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
