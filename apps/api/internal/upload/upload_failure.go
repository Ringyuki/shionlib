package upload

import "time"

type FailureStage string

const (
	FailureOpening    FailureStage = "open"
	FailureReading    FailureStage = "read"
	FailureSending    FailureStage = "chunk"
	FailureCompleting FailureStage = "complete"
	FailureSubmitting FailureStage = "submit"
)

const MaxFailureAttempts = 10

type ClientError struct {
	Name      string
	Message   string
	Status    *int
	Code      *int
	RequestID *string
	Ray       *string
}

type FailureAttempt struct {
	At    time.Time
	Wait  string
	Error ClientError
}

type FailureReport struct {
	SessionID *int
	Stage     FailureStage
	Reason    string
	Error     ClientError
	Chunk     *int
	FileName  string
	FileSize  int64
	Attempts  []FailureAttempt
	Client    string
	IP        string
	UserAgent string
}
