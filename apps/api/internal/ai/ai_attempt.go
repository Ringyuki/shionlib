package ai

import "time"

type routeFailures struct {
	count int
	until time.Time
}

type attemptRecord struct {
	target     Target
	route      RouteTarget
	callID     string
	started    time.Time
	duration   time.Duration
	completion Completion
	failure    *Failure
	adaptation *string
	payload    Payload
}
