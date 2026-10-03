package ai_test

import (
	"math"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestCostUsesCachePricesAndContextTiers(t *testing.T) {
	cacheRead, tierCache := 0.1, 0.2
	price := ai.Price{Input: 1, Output: 4, CacheRead: &cacheRead, Tiers: []ai.PriceTier{{Over: 200_000, Input: 2, Output: 8, CacheRead: &tierCache}}}
	small := ai.Cost(price, ai.Usage{InputTokens: 100_000, CacheReadTokens: 40_000, OutputTokens: 10_000})
	if math.Abs(small-(60_000*1+40_000*0.1+10_000*4)/1e6) > 1e-12 {
		t.Fatalf("small %v", small)
	}
	large := ai.Cost(price, ai.Usage{InputTokens: 300_000, OutputTokens: 1000})
	if math.Abs(large-(300_000*2+1000*8)/1e6) > 1e-12 {
		t.Fatalf("tiered %v", large)
	}
	if ai.Cost(ai.Price{Input: 1}, ai.Usage{InputTokens: 10, CacheReadTokens: 20}) < 0 {
		t.Fatal("fresh input never goes negative")
	}
}
