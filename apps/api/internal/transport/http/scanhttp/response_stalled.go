package scanhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type stalledCheckDTO struct {
	FileID     int                     `json:"file_id"`
	FileName   string                  `json:"file_name"`
	FileSize   int64                   `json:"file_size"`
	ResourceID int                     `json:"resource_id"`
	Game       malwareGameDTO          `json:"game"`
	Uploader   userhttp.UserSummaryDTO `json:"uploader"`
	Failures   int                     `json:"failures" doc:"Checks that failed in a row"`
	Reason     string                  `json:"reason" doc:"What the last failed check reported"`
	Uploaded   time.Time               `json:"uploaded"`
	StalledAt  *time.Time              `json:"stalled_at"`
	Deadline   time.Time               `json:"deadline" doc:"When the file is given up and removed if nobody handles it"`
}

func toStalledCheck(entry scan.StalledEntry, now time.Time) stalledCheckDTO {
	file := entry.File
	return stalledCheckDTO{
		FileID:     file.ID,
		FileName:   file.Name,
		FileSize:   file.Size,
		ResourceID: file.ResourceID,
		Game:       toGame(entry.Game),
		Uploader:   userhttp.ToUserSummary(entry.Uploader, now),
		Failures:   file.CheckFailures,
		Reason:     entry.Reason,
		Uploaded:   file.Created,
		StalledAt:  file.StalledAt,
		Deadline:   entry.Deadline,
	}
}
