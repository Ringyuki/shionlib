package scan

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func (f PendingFile) stalled() bool {
	return f.Type == download.FileTypeObjectStore && f.Status == download.FileOnServer && f.CheckStatus == download.CheckStalled
}

func stalledSameUpload(now, seen PendingFile) bool {
	return now.stalled() && now.Path == seen.Path
}

type CheckFailure struct {
	Failures  int
	Reason    string
	StalledAt *time.Time
}

func retryDelay(failures int) time.Duration {
	delay := checkRetryDelay
	for step := 1; step < failures && delay < checkRetryLimit; step++ {
		delay *= 2
	}
	return min(delay, checkRetryLimit)
}

func failureReason(cause error) string {
	reason := []rune(inspection.ReadableText(cause.Error()))
	if len(reason) > checkReasonLimit {
		reason = reason[:checkReasonLimit]
	}
	return string(reason)
}

type Resumed struct {
	ResourceID int
	Files      []string
}

func stalledUnits(files []PendingFile) []Unit {
	byResource := map[int][]PendingFile{}
	var order []int
	for _, file := range files {
		if _, seen := byResource[file.ResourceID]; !seen {
			order = append(order, file.ResourceID)
		}
		byResource[file.ResourceID] = append(byResource[file.ResourceID], file)
	}
	var units []Unit
	for _, resourceID := range order {
		units = append(units, Units(byResource[resourceID])...)
	}
	return units
}

func (u Unit) wanted(fileIDs []int) bool {
	if len(fileIDs) == 0 {
		return true
	}
	return slices.ContainsFunc(u.Files, func(file PendingFile) bool { return slices.Contains(fileIDs, file.ID) })
}

type StalledAlert struct {
	FileName     string
	UploaderName string
	GameTitle    string
	Failures     int
	Reason       string
	Deadline     time.Time
	ResourceURL  string
}
