package ai

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

type ProviderKind string

const (
	KindCompatible ProviderKind = "compatible"
	KindOpenAI     ProviderKind = "openai"
	KindAnthropic  ProviderKind = "anthropic"
	KindGoogle     ProviderKind = "google"
)

func (k ProviderKind) Valid() bool {
	return k == KindCompatible || k == KindOpenAI || k == KindAnthropic || k == KindGoogle
}

func (k ProviderKind) Protocols() []Protocol {
	switch k {
	case KindOpenAI:
		return []Protocol{ProtocolResponses, ProtocolModeration}
	case KindAnthropic:
		return []Protocol{ProtocolMessages}
	case KindGoogle:
		return []Protocol{ProtocolGemini}
	default:
		return []Protocol{ProtocolChat, ProtocolResponses, ProtocolMessages, ProtocolGemini, ProtocolModeration}
	}
}

func (k ProviderKind) Supports(protocol Protocol) bool {
	return slices.Contains(k.Protocols(), protocol)
}

func (k ProviderKind) RequiresBaseURL() bool {
	return k == KindCompatible
}

func (k ProviderKind) ProtocolFor(requested Protocol, moderation bool) Protocol {
	if moderation {
		return ProtocolModeration
	}
	if k.Supports(requested) && requested != ProtocolModeration {
		return requested
	}
	return k.Protocols()[0]
}

type Protocol string

const (
	ProtocolChat       Protocol = "chat"
	ProtocolResponses  Protocol = "responses"
	ProtocolMessages   Protocol = "messages"
	ProtocolGemini     Protocol = "gemini"
	ProtocolModeration Protocol = "moderation"
)

var generativeProtocols = []Protocol{ProtocolChat, ProtocolResponses, ProtocolMessages, ProtocolGemini}

func (p Protocol) Valid() bool {
	return p == ProtocolModeration || slices.Contains(generativeProtocols, p)
}

func (p Protocol) Generative() bool {
	return slices.Contains(generativeProtocols, p)
}

type RouteStatus string

const (
	RouteActive    RouteStatus = "active"
	RouteDisabled  RouteStatus = "disabled"
	RouteSuspended RouteStatus = "suspended"
)

func (s RouteStatus) Valid() bool {
	return s == RouteActive || s == RouteDisabled || s == RouteSuspended
}

type ErrorKind string

const (
	ErrorAuth       ErrorKind = "auth"
	ErrorQuota      ErrorKind = "quota"
	ErrorNotFound   ErrorKind = "not_found"
	ErrorProtocol   ErrorKind = "protocol"
	ErrorParam      ErrorKind = "param"
	ErrorStructured ErrorKind = "structured"
	ErrorRateLimit  ErrorKind = "rate_limit"
	ErrorUpstream   ErrorKind = "upstream"
	ErrorNetwork    ErrorKind = "network"
	ErrorTimeout    ErrorKind = "timeout"
	ErrorMalformed  ErrorKind = "malformed"
	ErrorTruncated  ErrorKind = "truncated"
	ErrorOther      ErrorKind = "other"
)

var errorKinds = []ErrorKind{ErrorAuth, ErrorQuota, ErrorNotFound, ErrorProtocol, ErrorParam, ErrorStructured, ErrorRateLimit, ErrorUpstream, ErrorNetwork, ErrorTimeout, ErrorMalformed, ErrorTruncated, ErrorOther}

func (k ErrorKind) Valid() bool {
	return slices.Contains(errorKinds, k)
}

func (k ErrorKind) Suspends() bool {
	return k == ErrorAuth || k == ErrorQuota || k == ErrorNotFound
}

func (k ErrorKind) OutputProblem() bool {
	return k == ErrorMalformed || k == ErrorTruncated
}

type Source string

const (
	SourceScene      Source = "scene"
	SourceCheck      Source = "check"
	SourcePlayground Source = "playground"
)

func (s Source) Valid() bool {
	return s == SourceScene || s == SourceCheck || s == SourcePlayground
}

type AdjustmentKind string

const (
	AdjustProtocol AdjustmentKind = "protocol"
	AdjustParam    AdjustmentKind = "param"
	AdjustJSONMode AdjustmentKind = "json_mode"
)

const (
	ParamTemperature     = "temperature"
	ParamMaxOutputTokens = "max_output_tokens"
)

const (
	cooldownFailures = 3
	cooldownPeriod   = time.Minute
	maxAdaptations   = 3
	probeConcurrency = 3
	maxErrorMessage  = 300
	maxErrorDetail   = 4000
)

type Page = paging.Page

type Price struct {
	Input      float64
	Output     float64
	CacheRead  *float64
	CacheWrite *float64
	Tiers      []PriceTier
}

type PriceTier struct {
	Over      int
	Input     float64
	Output    float64
	CacheRead *float64
}

type Usage struct {
	InputTokens      int
	OutputTokens     int
	CacheReadTokens  int
	CacheWriteTokens int
	ReasoningTokens  int
}

func (u Usage) Add(other Usage) Usage {
	return Usage{
		InputTokens:      u.InputTokens + other.InputTokens,
		OutputTokens:     u.OutputTokens + other.OutputTokens,
		CacheReadTokens:  u.CacheReadTokens + other.CacheReadTokens,
		CacheWriteTokens: u.CacheWriteTokens + other.CacheWriteTokens,
		ReasoningTokens:  u.ReasoningTokens + other.ReasoningTokens,
	}
}

type Capabilities struct {
	Vision       bool
	Moderation   bool
	Temperature  bool
	ToolCall     bool
	Reasoning    bool
	ContextLimit *int
	OutputLimit  *int
}

type Provider struct {
	ID                int
	Name              string
	Kind              ProviderKind
	BaseURL           *string
	KeyHint           string
	PriceMultiplier   float64
	CatalogProviderID *string
	Enabled           bool
	Created           time.Time
	Updated           time.Time
}

type NewProvider struct {
	Name              string
	Kind              ProviderKind
	BaseURL           *string
	APIKey            string
	PriceMultiplier   float64
	CatalogProviderID *string
}

type ProviderChanges struct {
	Name              *string
	Kind              *ProviderKind
	BaseURL           **string
	APIKey            *string
	PriceMultiplier   *float64
	CatalogProviderID **string
	Enabled           *bool
}

type Model struct {
	ID          int
	Key         string
	Name        string
	Description *string
	CanonicalID *string
	Capabilities
	IsDefault bool
	Enabled   bool
	Created   time.Time
	Updated   time.Time
}

type NewModel struct {
	Key         string
	Name        string
	Description *string
	CanonicalID *string
	Capabilities
}

type ModelChanges struct {
	Name         *string
	Description  **string
	CanonicalID  **string
	Capabilities *Capabilities
	Enabled      *bool
	IsDefault    *bool
}

type ModelRef struct {
	ID         int
	Key        string
	Name       string
	Moderation bool
}

type ProviderRef struct {
	ID   int
	Name string
	Kind ProviderKind
}

type Route struct {
	ID            int
	Model         ModelRef
	Provider      ProviderRef
	UpstreamID    string
	Protocol      Protocol
	PriceManual   bool
	Price         Price
	DroppedParams []string
	JSONMode      bool
	Priority      int
	Status        RouteStatus
	StatusKind    *ErrorKind
	StatusMessage *string
	StatusAt      *time.Time
	Adjustments   []Adjustment
	Created       time.Time
	Updated       time.Time
}

type NewRoute struct {
	ModelID     int
	ProviderID  int
	UpstreamID  string
	Protocol    Protocol
	PriceManual bool
	Price       Price
	Priority    int
}

type RouteChanges struct {
	UpstreamID    *string
	Protocol      *Protocol
	PriceManual   *bool
	Price         *Price
	DroppedParams *[]string
	JSONMode      *bool
}

type RouteFilter struct {
	IDs        []int
	ModelID    *int
	ProviderID *int
	Status     *RouteStatus
}

type Adjustment struct {
	ID        int
	Kind      AdjustmentKind
	Value     string
	Previous  *string
	ErrorKind ErrorKind
	RequestID *int64
	Created   time.Time
}

type NewAdjustment struct {
	Kind      AdjustmentKind
	Value     string
	Previous  *string
	ErrorKind ErrorKind
	RequestID *int64
}

type RouteCounts struct {
	Total     int
	Active    int
	Suspended int
	Disabled  int
}

type ProviderSummary struct {
	Provider
	Routes         RouteCounts
	SuspendedKinds []ErrorKind
	UpstreamIDs    []string
}

type RouteBatchAction string

const (
	BatchEnable  RouteBatchAction = "enable"
	BatchDisable RouteBatchAction = "disable"
	BatchDelete  RouteBatchAction = "delete"
)

func (a RouteBatchAction) Valid() bool {
	return a == BatchEnable || a == BatchDisable || a == BatchDelete
}

func sameCapabilities(a, b Capabilities) bool {
	return a.Vision == b.Vision && a.Moderation == b.Moderation && a.Temperature == b.Temperature &&
		a.ToolCall == b.ToolCall && a.Reasoning == b.Reasoning &&
		sameInt(a.ContextLimit, b.ContextLimit) && sameInt(a.OutputLimit, b.OutputLimit)
}

func sameInt(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
