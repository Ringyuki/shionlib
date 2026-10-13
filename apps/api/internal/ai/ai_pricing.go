package ai

import (
	"math"
	"slices"
)

const tokensPerPrice = 1_000_000

func Cost(price Price, usage Usage) float64 {
	input, output, cacheRead := price.Input, price.Output, price.CacheRead
	for _, tier := range price.Tiers {
		if usage.InputTokens > tier.Over {
			input, output = tier.Input, tier.Output
			if tier.CacheRead != nil {
				cacheRead = tier.CacheRead
			}
		}
	}
	readPrice, writePrice := input, input
	if cacheRead != nil {
		readPrice = *cacheRead
	}
	if price.CacheWrite != nil {
		writePrice = *price.CacheWrite
	}
	fresh := max(0, usage.InputTokens-usage.CacheReadTokens-usage.CacheWriteTokens)
	return (float64(fresh)*input +
		float64(usage.CacheReadTokens)*readPrice +
		float64(usage.CacheWriteTokens)*writePrice +
		float64(usage.OutputTokens)*output) / tokensPerPrice
}

func scaledPrice(entry CatalogModel, multiplier float64) Price {
	scale := func(value *float64) *float64 {
		if value == nil {
			return nil
		}
		scaled := *value * multiplier
		return &scaled
	}
	price := Price{
		Input:      valueOr(entry.InputPrice, 0) * multiplier,
		Output:     valueOr(entry.OutputPrice, 0) * multiplier,
		CacheRead:  scale(entry.CacheReadPrice),
		CacheWrite: scale(entry.CacheWritePrice),
	}
	for _, tier := range entry.PriceTiers {
		price.Tiers = append(price.Tiers, PriceTier{Over: tier.Over, Input: tier.Input * multiplier, Output: tier.Output * multiplier, CacheRead: scale(tier.CacheRead)})
	}
	return price
}

func samePrice(a, b Price) bool {
	return nearly(a.Input, b.Input) && nearly(a.Output, b.Output) &&
		sameOptional(a.CacheRead, b.CacheRead) && sameOptional(a.CacheWrite, b.CacheWrite) &&
		slices.EqualFunc(a.Tiers, b.Tiers, func(x, y PriceTier) bool {
			return x.Over == y.Over && nearly(x.Input, y.Input) && nearly(x.Output, y.Output) && sameOptional(x.CacheRead, y.CacheRead)
		})
}

func sameOptional(a, b *float64) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return nearly(*a, *b)
}

func nearly(a, b float64) bool {
	return math.Abs(a-b) <= 1e-9*math.Max(1, math.Max(math.Abs(a), math.Abs(b)))
}

func valueOr[T any](value *T, fallback T) T {
	if value == nil {
		return fallback
	}
	return *value
}
