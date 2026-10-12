package catalog

import "time"

type SyncState struct {
	Cursor    string
	PulledAt  *time.Time
	Changes   int
	FailedAt  *time.Time
	LastError *string
}

type LinkCounts struct {
	Games      int
	Developers int
	Characters int
}

type SourceStatus struct {
	Name        string
	Incremental bool
	Counts      LinkCounts
	Sync        SyncState
	Refreshes   time.Duration
}

type Exclusion struct {
	Title  string
	UserID int
}

type Remover struct {
	ID   int
	Name string
}

type ExcludedEntry struct {
	Ref        Ref
	Title      *string
	ExcludedAt time.Time
	ExcludedBy *Remover
}
