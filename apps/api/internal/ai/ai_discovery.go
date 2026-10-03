package ai

import (
	"cmp"
	"slices"
	"strconv"
	"time"
)

type UpstreamModel struct {
	ID        string
	Name      *string
	Owner     *string
	Protocols []Protocol
	Native    *Protocol
}

type Offer struct {
	ProviderID  int
	UpstreamID  string
	Name        *string
	Protocols   []Protocol
	CanonicalID *string
	SyncedAt    time.Time
}

type OfferFilter struct {
	ProviderIDs   []int
	UpstreamIDs   []string
	CanonicalIDs  []string
	WithCanonical bool
	EnabledOnly   bool
}

type DiscoveredModel struct {
	UpstreamID  string
	Name        string
	CanonicalID *string
	Lab         *string
	Protocol    Protocol
	Protocols   []Protocol
	Capabilities
	InputPrice  *float64
	OutputPrice *float64
}

type DiscoveredOffer struct {
	DiscoveredModel
	ModelID *int
	RouteID *int
}

type Discovery struct {
	Failure *Failure
	Models  []DiscoveredOffer
}

type ResolvedModel struct {
	UpstreamID  string
	ModelID     *int
	ModelName   *string
	CanonicalID *string
	CatalogName *string
}

type RouteItem struct {
	UpstreamID string
	Protocol   Protocol
}

type AddRoutesResult struct {
	RouteIDs []int
	Skipped  []string
}

type pricedConnection struct {
	Kind              ProviderKind
	CatalogProviderID *string
	PriceMultiplier   float64
}

func describe(index CatalogIndex, connection pricedConnection, upstream UpstreamModel) (DiscoveredModel, bool) {
	exact, hasExact := index.Exact(connection.CatalogProviderID, upstream.ID)
	canonical := ""
	if hasExact && exact.CanonicalID != nil {
		canonical = *exact.CanonicalID
	} else if found, ok := index.CanonicalOf(upstream.ID); ok {
		canonical = found
	}
	official, hasOfficial := CatalogModel{}, false
	if canonical != "" {
		official, hasOfficial = index.Official(canonical)
	}
	entry, hasEntry := official, hasOfficial
	if !hasEntry {
		entry, hasEntry = exact, hasExact
	}
	moderation := isModerationModel(upstream.ID) || (hasEntry && entry.Capabilities().Moderation) || slices.Contains(upstream.Protocols, ProtocolModeration)
	if hasEntry && !moderation && !entry.producesText() {
		return DiscoveredModel{}, false
	}
	if moderation && !connection.Kind.Supports(ProtocolModeration) {
		return DiscoveredModel{}, false
	}
	available := availableProtocols(connection.Kind, exact, hasExact, upstream, moderation)
	if len(available) == 0 {
		return DiscoveredModel{}, false
	}
	protocol := preferredProtocol(index, canonical, upstream, available)
	model := DiscoveredModel{
		UpstreamID:   upstream.ID,
		Name:         upstream.ID,
		Protocol:     protocol,
		Protocols:    available,
		Capabilities: Capabilities{Temperature: true, Moderation: moderation},
	}
	if upstream.Name != nil {
		model.Name = *upstream.Name
	}
	if hasEntry {
		model.Name = entry.Name
		model.Capabilities = entry.Capabilities()
		model.Moderation = moderation
	}
	if canonical != "" {
		lab := labOf(canonical)
		model.CanonicalID, model.Lab = &canonical, &lab
	} else if upstream.Owner != nil {
		model.Lab = upstream.Owner
	}
	priced, hasPriced := exact, hasExact
	if !hasPriced {
		priced, hasPriced = official, hasOfficial
	}
	if hasPriced && priced.InputPrice != nil {
		price := scaledPrice(priced, connection.PriceMultiplier)
		model.InputPrice, model.OutputPrice = &price.Input, &price.Output
	}
	return model, true
}

func availableProtocols(kind ProviderKind, exact CatalogModel, hasExact bool, upstream UpstreamModel, moderation bool) []Protocol {
	if moderation {
		return []Protocol{ProtocolModeration}
	}
	listed := upstream.Protocols
	if listed == nil && hasExact {
		if protocol, ok := nativeProtocols[valueOr(exact.NPM, "")]; ok {
			listed = []Protocol{protocol}
		}
	}
	supported := slices.DeleteFunc(slices.Clone(kind.Protocols()), func(protocol Protocol) bool { return !protocol.Generative() })
	if kind != KindCompatible {
		return supported
	}
	if listed == nil {
		return supported
	}
	return slices.DeleteFunc(slices.Clone(listed), func(protocol Protocol) bool { return !protocol.Generative() })
}

func preferredProtocol(index CatalogIndex, canonical string, upstream UpstreamModel, available []Protocol) Protocol {
	if upstream.Native != nil && slices.Contains(available, *upstream.Native) {
		return *upstream.Native
	}
	if native := index.NativeProtocol(canonical); slices.Contains(available, native) {
		return native
	}
	if slices.Contains(available, ProtocolChat) {
		return ProtocolChat
	}
	return available[0]
}

func sortDiscovered(models []DiscoveredModel) {
	slices.SortStableFunc(models, func(a, b DiscoveredModel) int {
		aLab, bLab := valueOr(a.Lab, ""), valueOr(b.Lab, "")
		if (aLab == "") != (bLab == "") {
			if aLab == "" {
				return 1
			}
			return -1
		}
		return cmp.Or(cmp.Compare(aLab, bLab), cmp.Compare(a.Name, b.Name))
	})
}

type providerConnection struct {
	ref    ProviderRef
	priced pricedConnection
}

func nilIfEmpty[T any](values []T) []T {
	if len(values) == 0 {
		return nil
	}
	return values
}

func offerKey(providerID int, upstreamID string) string {
	return strconv.Itoa(providerID) + "|" + upstreamID
}

func routeFor(routes []Route, upstreamID string) (Route, bool) {
	for _, route := range routes {
		if route.UpstreamID == upstreamID {
			return route, true
		}
	}
	return Route{}, false
}

func offerFor(offers []Offer, upstreamID string) (Offer, bool) {
	for _, offer := range offers {
		if offer.UpstreamID == upstreamID {
			return offer, true
		}
	}
	return Offer{}, false
}

func matchModel(models []Model, canonical *string, upstreamID string) (Model, bool) {
	if canonical != nil {
		for _, model := range models {
			if model.CanonicalID != nil && *model.CanonicalID == *canonical {
				return model, true
			}
		}
	}
	for _, model := range models {
		if model.Key == upstreamID {
			return model, true
		}
	}
	return Model{}, false
}
