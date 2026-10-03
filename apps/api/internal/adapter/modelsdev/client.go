package modelsdev

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"slices"
	"sort"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const maxCatalogBytes = 64 << 20

var errNotObject = errors.New("catalog payload is not an object")

type Client struct {
	http *http.Client
	url  string
}

func NewClient(httpClient *http.Client, url string) *Client {
	return &Client{http: httpClient, url: url}
}

func (c *Client) Fetch(ctx context.Context) (ai.Catalog, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return ai.Catalog{}, ai.ErrCatalogUnavailable.Wrap(fmt.Errorf("build catalog request: %w", err))
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return ai.Catalog{}, ai.ErrCatalogUnavailable.Wrap(fmt.Errorf("fetch catalog: %w", err))
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ai.Catalog{}, ai.ErrCatalogUnavailable.Wrap(fmt.Errorf("catalog responded %d", resp.StatusCode))
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxCatalogBytes))
	if err != nil {
		return ai.Catalog{}, ai.ErrCatalogUnavailable.Wrap(fmt.Errorf("read catalog: %w", err))
	}
	catalog, err := parseCatalog(data)
	if err != nil {
		return ai.Catalog{}, ai.ErrCatalogUnavailable.Wrap(err)
	}
	return catalog, nil
}

func parseCatalog(data []byte) (ai.Catalog, error) {
	var root map[string]json.RawMessage
	if err := json.Unmarshal(data, &root); err != nil {
		return ai.Catalog{}, fmt.Errorf("decode catalog: %w", err)
	}
	if root == nil {
		return ai.Catalog{}, errNotObject
	}
	keys := make([]string, 0, len(root))
	for key := range root {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var catalog ai.Catalog
	for _, key := range keys {
		var entry providerRecord
		if json.Unmarshal(root[key], &entry) != nil {
			continue
		}
		id := text(entry.ID)
		if id == nil {
			id = &key
		}
		provider := ai.CatalogProvider{ID: *id, Name: *id, NPM: text(entry.NPM), APIURL: text(entry.API), DocURL: text(entry.Doc)}
		if name := text(entry.Name); name != nil {
			provider.Name = *name
		}
		catalog.Providers = append(catalog.Providers, provider)
		modelKeys := make([]string, 0, len(entry.Models))
		for modelKey := range entry.Models {
			modelKeys = append(modelKeys, modelKey)
		}
		sort.Strings(modelKeys)
		for _, modelKey := range modelKeys {
			var record modelRecord
			if json.Unmarshal(entry.Models[modelKey], &record) != nil {
				continue
			}
			catalog.Models = append(catalog.Models, toModel(provider.ID, modelKey, record))
		}
	}
	return catalog, nil
}

func toModel(providerID, modelKey string, record modelRecord) ai.CatalogModel {
	model := ai.CatalogModel{
		ProviderID:       providerID,
		ModelKey:         modelKey,
		CanonicalID:      text(record.CanonicalModelID),
		Name:             modelKey,
		Type:             text(record.Type),
		Family:           text(record.Family),
		InputModalities:  stringList(record.Modalities.Input),
		OutputModalities: stringList(record.Modalities.Output),
		ContextLimit:     count(record.Limit.Context),
		OutputLimit:      count(record.Limit.Output),
		Temperature:      !isFalse(record.Temperature),
		ToolCall:         isTrue(record.ToolCall),
		Reasoning:        isTrue(record.Reasoning),
		StructuredOutput: boolean(record.StructuredOutput),
		InputPrice:       money(record.Cost.Input),
		OutputPrice:      money(record.Cost.Output),
		CacheReadPrice:   money(record.Cost.CacheRead),
		CacheWritePrice:  money(record.Cost.CacheWrite),
		PriceTiers:       tiers(record.Cost.Tiers),
		ReleaseDate:      text(record.ReleaseDate),
	}
	if id := text(record.ID); id != nil {
		model.ModelKey = *id
	}
	if name := text(record.Name); name != nil {
		model.Name = *name
	}
	if record.Provider != nil {
		model.NPM = text(record.Provider.NPM)
	}
	return model
}

func tiers(items []json.RawMessage) []ai.PriceTier {
	var result []ai.PriceTier
	for _, item := range items {
		var record tierRecord
		if json.Unmarshal(item, &record) != nil || record.Tier == nil || valueOf(text(record.Tier.Type)) != "context" {
			continue
		}
		over, input, output := count(record.Tier.Size), money(record.Input), money(record.Output)
		if over == nil || input == nil || output == nil {
			continue
		}
		result = append(result, ai.PriceTier{Over: *over, Input: *input, Output: *output, CacheRead: money(record.CacheRead)})
	}
	slices.SortStableFunc(result, func(a, b ai.PriceTier) int { return a.Over - b.Over })
	return result
}

func text(raw json.RawMessage) *string {
	var value string
	if json.Unmarshal(raw, &value) != nil || value == "" {
		return nil
	}
	return &value
}

func valueOf(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func number(raw json.RawMessage) (float64, bool) {
	var value float64
	if json.Unmarshal(raw, &value) != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return 0, false
	}
	return value, true
}

func count(raw json.RawMessage) *int {
	value, ok := number(raw)
	if !ok {
		return nil
	}
	rounded := int(math.Round(value))
	return &rounded
}

func money(raw json.RawMessage) *float64 {
	value, ok := number(raw)
	if !ok {
		return nil
	}
	return &value
}

func boolean(raw json.RawMessage) *bool {
	var value bool
	if json.Unmarshal(raw, &value) != nil {
		return nil
	}
	return &value
}

func isTrue(raw json.RawMessage) bool {
	value := boolean(raw)
	return value != nil && *value
}

func isFalse(raw json.RawMessage) bool {
	value := boolean(raw)
	return value != nil && !*value
}

func stringList(items []json.RawMessage) []string {
	result := []string{}
	for _, item := range items {
		var value string
		if json.Unmarshal(item, &value) == nil {
			result = append(result, value)
		}
	}
	return result
}
