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

type activityFileDTO struct {
	ID         int    `json:"id"`
	ResourceID int    `json:"resource_id"`
	FileName   string `json:"file_name"`
	FileSize   int64  `json:"file_size"`
}

type activityDTO struct {
	ID          int                     `json:"id"`
	Type        string                  `json:"type" enum:"FILE_UPLOAD_TO_S3,COMMENT,WALKTHROUGH_CREATE" doc:"A file became downloadable, a comment was accepted, or a walkthrough was written"`
	User        userhttp.UserSummaryDTO `json:"user"`
	Game        *gamehttp.GameCardDTO   `json:"game"`
	Walkthrough *activityWalkthroughDTO `json:"walkthrough"`
	Comment     *activityCommentDTO     `json:"comment"`
	File        *activityFileDTO        `json:"file"`
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
	if ref := entry.File; ref != nil {
		out.File = &activityFileDTO{ID: ref.ID, ResourceID: ref.ResourceID, FileName: ref.FileName, FileSize: ref.FileSize}
	}
	return out
}
