package aimoderation

import "encoding/json"

type verdictRecord struct {
	Decision    string          `json:"decision"`
	Reason      string          `json:"reason"`
	Evidence    string          `json:"evidence"`
	TopCategory string          `json:"top_category"`
	Categories  json.RawMessage `json:"categories_json"`
}
