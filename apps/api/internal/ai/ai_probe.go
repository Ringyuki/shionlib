package ai

import "encoding/json"

const (
	checkPrompt     = `Reply with the JSON object {"ok": true}.`
	checkSchemaName = "check"
	checkInput      = "ping"
)

var checkSchema = json.RawMessage(`{"type":"object","additionalProperties":false,"properties":{"ok":{"type":"boolean"}},"required":["ok"]}`)

type RouteUpdate struct {
	UpstreamID  *string
	Protocol    *Protocol
	PriceManual *bool
	InputPrice  *float64
	OutputPrice *float64
	Status      *RouteStatus
}
