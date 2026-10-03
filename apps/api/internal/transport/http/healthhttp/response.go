package healthhttp

import (
	"time"
)

type HealthStatusDTO struct {
	Status    string            `json:"status" enum:"ok,error"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks"`
	LatencyMs int64             `json:"latencyMs"`
}

type healthLivenessDTO struct {
	Status string `json:"status"`
}
