package upload

import "time"

type OngoingSession struct {
	Session
	HeldElsewhere bool
}

type Holdings struct {
	Held      []int
	Elsewhere []int
	TTL       time.Duration
}
