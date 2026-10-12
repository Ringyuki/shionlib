package adminhttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
)

type adminStatsOverviewDTO struct {
	TotalGames        int   `json:"totalGames"`
	TotalUsers        int   `json:"totalUsers"`
	TotalDownloads    int64 `json:"totalDownloads"`
	TotalViews        int64 `json:"totalViews"`
	TotalCharacters   int   `json:"totalCharacters"`
	TotalDevelopers   int   `json:"totalDevelopers"`
	TotalComments     int   `json:"totalComments"`
	TotalResources    int   `json:"totalResources" doc:"Published resources"`
	NewGamesToday     int   `json:"newGamesToday"`
	NewUsersToday     int   `json:"newUsersToday"`
	NewResourcesToday int   `json:"newResourcesToday"`
	NewCommentsToday  int   `json:"newCommentsToday"`
	DownloadsToday    int   `json:"downloadsToday"`
	ViewsToday        int   `json:"viewsToday"`
}

type adminStatsTrendDTO struct {
	Date      string `json:"date" doc:"YYYY-MM-DD in UTC+8"`
	Games     int    `json:"games"`
	Users     int    `json:"users"`
	Downloads int    `json:"downloads" doc:"Download links issued that day; counted since the daily counters exist"`
	Views     int    `json:"views" doc:"Game page views that day; counted since the daily counters exist"`
}

type adminPendingDTO struct {
	Reports      int `json:"reports" doc:"Reports waiting for a verdict"`
	MalwareCases int `json:"malware_cases" doc:"Files the virus scan flagged, waiting for review"`
	StalledFiles int `json:"stalled_files" doc:"Files whose check was paused after repeated failures"`
	Comments     int `json:"comments" doc:"Comments held for review"`
	Walkthroughs int `json:"walkthroughs" doc:"Walkthroughs held for review"`
}

type adminTallyDTO struct {
	Files int   `json:"files"`
	Bytes int64 `json:"bytes"`
}

type adminStorageDTO struct {
	SpoolCapacity  int64         `json:"spool_capacity" doc:"Bytes of the volume uploads are staged on"`
	SpoolAvailable int64         `json:"spool_available" doc:"Free bytes on that volume"`
	SpoolReserve   int64         `json:"spool_reserve" doc:"Free bytes below which no new upload is accepted"`
	Uploading      adminTallyDTO `json:"uploading" doc:"Uploads in progress and their declared sizes"`
	AwaitingCheck  int           `json:"awaiting_check" doc:"Uploaded files not yet checked"`
	AwaitingStore  int           `json:"awaiting_store" doc:"Checked files not yet in the object store"`
	Stored         adminTallyDTO `json:"stored" doc:"Files of active resources in the object store"`
}

func toStorageDTO(s admin.Storage) adminStorageDTO {
	return adminStorageDTO{
		SpoolCapacity:  s.SpoolCapacity,
		SpoolAvailable: s.SpoolAvailable,
		SpoolReserve:   s.SpoolReserve,
		Uploading:      adminTallyDTO(s.Uploading),
		AwaitingCheck:  s.AwaitingCheck,
		AwaitingStore:  s.AwaitingStore,
		Stored:         adminTallyDTO(s.Stored),
	}
}
