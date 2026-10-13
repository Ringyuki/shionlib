package ai

import (
	"regexp"
	"slices"
	"strings"
	"time"
)

type CatalogProvider struct {
	ID     string
	Name   string
	NPM    *string
	APIURL *string
	DocURL *string
}

func (p CatalogProvider) ProviderKind() (ProviderKind, bool) {
	npm := valueOr(p.NPM, "")
	switch {
	case npm == "@ai-sdk/anthropic":
		return KindAnthropic, true
	case npm == "@ai-sdk/google":
		return KindGoogle, true
	case npm == "@ai-sdk/openai" && p.APIURL == nil:
		return KindOpenAI, true
	case p.APIURL != nil:
		return KindCompatible, true
	}
	return "", false
}

type CatalogModel struct {
	ProviderID       string
	ModelKey         string
	CanonicalID      *string
	Name             string
	Type             *string
	Family           *string
	NPM              *string
	InputModalities  []string
	OutputModalities []string
	ContextLimit     *int
	OutputLimit      *int
	Temperature      bool
	ToolCall         bool
	Reasoning        bool
	StructuredOutput *bool
	InputPrice       *float64
	OutputPrice      *float64
	CacheReadPrice   *float64
	CacheWritePrice  *float64
	PriceTiers       []PriceTier
	ReleaseDate      *string
}

func (m CatalogModel) Capabilities() Capabilities {
	return Capabilities{
		Vision:       slices.Contains(m.InputModalities, "image"),
		Moderation:   isModerationModel(m.ModelKey) || valueOr(m.Type, "") == "moderation",
		Temperature:  m.Temperature,
		ToolCall:     m.ToolCall,
		Reasoning:    m.Reasoning,
		ContextLimit: m.ContextLimit,
		OutputLimit:  m.OutputLimit,
	}
}

func (m CatalogModel) producesText() bool {
	return len(m.OutputModalities) == 0 || slices.Contains(m.OutputModalities, "text")
}

type Catalog struct {
	Providers []CatalogProvider
	Models    []CatalogModel
}

type CatalogChanges struct {
	Providers int
	Models    int
	Added     int
	Updated   int
	Removed   int
}

type CatalogSyncResult struct {
	CatalogChanges
	Repriced int
}

type CatalogStatus struct {
	Providers int
	Models    int
	SyncedAt  *time.Time
}

type CatalogProviderEntry struct {
	CatalogProvider
	Kind   ProviderKind
	Models int
}

type CatalogOffer struct {
	Provider    ProviderRef
	UpstreamID  string
	Protocol    Protocol
	Protocols   []Protocol
	InputPrice  *float64
	OutputPrice *float64
}

type CatalogEntry struct {
	CanonicalID string
	Name        string
	Lab         string
	Capabilities
	InputPrice  *float64
	OutputPrice *float64
	ModelID     *int
	Offers      []CatalogOffer
}

var nativeProtocols = map[string]Protocol{
	"@ai-sdk/openai":    ProtocolResponses,
	"@ai-sdk/anthropic": ProtocolMessages,
	"@ai-sdk/google":    ProtocolGemini,
}

var (
	idSeparators = regexp.MustCompile(`[._\s]+`)
	idVersion    = regexp.MustCompile(`-(?:\d{8}|\d{4}-\d{2}-\d{2}|latest)$`)
)

func normalizeModelID(id string) string {
	parts := strings.Split(strings.ToLower(id), "/")
	last := parts[len(parts)-1]
	last, _, _ = strings.Cut(last, ":")
	last = idSeparators.ReplaceAllString(last, "-")
	return idVersion.ReplaceAllString(last, "")
}

func isModerationModel(id string) bool {
	return strings.Contains(strings.ToLower(id), "moderation")
}

func labOf(canonical string) string {
	lab, _, _ := strings.Cut(canonical, "/")
	return lab
}

type CatalogIndex struct {
	providers  map[string]CatalogProvider
	exact      map[string]CatalogModel
	canonical  map[string][]CatalogModel
	byKey      map[string]string
	loose      map[string]string
	byProvider map[string][]CatalogModel
}

func NewCatalogIndex(catalog Catalog) CatalogIndex {
	index := CatalogIndex{
		providers:  map[string]CatalogProvider{},
		exact:      map[string]CatalogModel{},
		canonical:  map[string][]CatalogModel{},
		byKey:      map[string]string{},
		loose:      map[string]string{},
		byProvider: map[string][]CatalogModel{},
	}
	for _, provider := range catalog.Providers {
		index.providers[provider.ID] = provider
	}
	for _, model := range catalog.Models {
		index.exact[model.ProviderID+"|"+model.ModelKey] = model
		index.byProvider[model.ProviderID] = append(index.byProvider[model.ProviderID], model)
		if model.CanonicalID == nil {
			continue
		}
		canonical := *model.CanonicalID
		index.canonical[canonical] = append(index.canonical[canonical], model)
		if _, ok := index.byKey[model.ModelKey]; !ok {
			index.byKey[model.ModelKey] = canonical
		}
		lab := labOf(canonical)
		for _, key := range []string{canonical, model.ModelKey} {
			normalized := normalizeModelID(key)
			if _, ok := index.loose[normalized]; !ok || model.ProviderID == lab {
				index.loose[normalized] = canonical
			}
		}
	}
	return index
}

func (i CatalogIndex) Empty() bool {
	return len(i.exact) == 0
}

func (i CatalogIndex) ProviderModels(providerID string) []CatalogModel {
	return i.byProvider[providerID]
}

func (i CatalogIndex) Exact(providerID *string, modelKey string) (CatalogModel, bool) {
	if providerID == nil {
		return CatalogModel{}, false
	}
	model, ok := i.exact[*providerID+"|"+modelKey]
	return model, ok
}

func (i CatalogIndex) CanonicalOf(upstreamID string) (string, bool) {
	if canonical, ok := i.byKey[upstreamID]; ok {
		return canonical, true
	}
	canonical, ok := i.loose[normalizeModelID(upstreamID)]
	return canonical, ok
}

func (i CatalogIndex) Official(canonical string) (CatalogModel, bool) {
	models := i.canonical[canonical]
	lab := labOf(canonical)
	for _, model := range models {
		if model.ProviderID == lab {
			return model, true
		}
	}
	if len(models) > 0 {
		return models[0], true
	}
	return CatalogModel{}, false
}

func (i CatalogIndex) NativeProtocol(canonical string) Protocol {
	if canonical == "" {
		return ProtocolChat
	}
	lab, ok := i.providers[labOf(canonical)]
	if !ok || lab.APIURL != nil {
		return ProtocolChat
	}
	if protocol, ok := nativeProtocols[valueOr(lab.NPM, "")]; ok {
		return protocol
	}
	return ProtocolChat
}

func (i CatalogIndex) Provider(id string) (CatalogProvider, bool) {
	provider, ok := i.providers[id]
	return provider, ok
}
