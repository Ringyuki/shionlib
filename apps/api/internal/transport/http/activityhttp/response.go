package activityhttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type activityWalkthroughDTO struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
}

type activityCommentDTO struct {
	ID   int     `json:"id"`
	HTML *string `json:"html"`
}

type activityDeveloperDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type activityCharacterDTO struct {
	ID     int     `json:"id"`
	NameJP string  `json:"name_jp"`
	NameZH *string `json:"name_zh"`
	NameEN *string `json:"name_en"`
}

type activityFileDTO struct {
	ID              int    `json:"id"`
	FileName        string `json:"file_name"`
	FileSize        int64  `json:"file_size"`
	FileStatus      *int   `json:"file_status"`
	FileCheckStatus *int   `json:"file_check_status"`
}

type activityDTO struct {
	ID          int                     `json:"id"`
	Type        string                  `json:"type"`
	User        userhttp.UserSummaryDTO `json:"user"`
	Game        *gamehttp.GameCardDTO   `json:"game"`
	Walkthrough *activityWalkthroughDTO `json:"walkthrough"`
	Comment     *activityCommentDTO     `json:"comment"`
	Developer   *activityDeveloperDTO   `json:"developer"`
	Character   *activityCharacterDTO   `json:"character"`
	File        *activityFileDTO        `json:"file,omitempty"`
	Created     time.Time               `json:"created"`
	Updated     time.Time               `json:"updated"`
}

type activityPageMetaDTO struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type activityPageDTO struct {
	Items []activityDTO       `json:"items"`
	Meta  activityPageMetaDTO `json:"meta"`
}

func toActivityDTO(entry activity.Entry, now time.Time) activityDTO {
	out := activityDTO{
		ID:      entry.ID,
		Type:    string(entry.Type),
		User:    userhttp.ToUserSummary(entry.User, now),
		Created: entry.Created,
		Updated: entry.Updated,
	}
	if entry.Game != nil {
		card := gamehttp.ToGameCard(*entry.Game)
		out.Game = &card
	}
	if ref := entry.Walkthrough; ref != nil {
		out.Walkthrough = &activityWalkthroughDTO{ID: ref.ID, Title: ref.Title}
	}
	if ref := entry.Comment; ref != nil {
		out.Comment = &activityCommentDTO{ID: ref.ID, HTML: ref.HTML}
	}
	if ref := entry.Developer; ref != nil {
		out.Developer = &activityDeveloperDTO{ID: ref.ID, Name: ref.Name}
	}
	if ref := entry.Character; ref != nil {
		out.Character = &activityCharacterDTO{ID: ref.ID, NameJP: ref.NameJP, NameZH: ref.NameZH, NameEN: ref.NameEN}
	}
	if ref := entry.File; ref != nil {
		out.File = &activityFileDTO{ID: ref.ID, FileName: ref.FileName, FileSize: ref.FileSize, FileStatus: ref.FileStatus, FileCheckStatus: ref.FileCheckStatus}
	}
	return out
}
