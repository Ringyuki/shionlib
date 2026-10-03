package moyu

import (
	"encoding/json"
	"time"
)

const (
	CacheTTL       = 5 * time.Minute
	CacheKeyPrefix = "moyu:patch:resources:vndb:"
)

type Resource = json.RawMessage

type Lookup struct {
	Found     bool
	Resources []Resource
}
