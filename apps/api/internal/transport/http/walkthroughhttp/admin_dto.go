package walkthroughhttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type adminWalkthroughPath struct {
	ID int `path:"id"`
}

type adminWalkthroughListInput struct {
	httpapi.PageQuery
	Search    string `query:"search"`
	SortBy    string `query:"sortBy" default:"created" enum:"id,title,created,updated,status"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
	Status    string `query:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	CreatorID int    `query:"creatorId"`
	GameID    int    `query:"gameId"`
}

func (in *adminWalkthroughListInput) filter() walkthrough.AdminFilter {
	filter := walkthrough.AdminFilter{
		Search:     in.Search,
		Status:     statusFilter(in.Status),
		SortBy:     walkthrough.SortField(in.SortBy),
		Descending: in.SortOrder != "asc",
	}
	if in.CreatorID != 0 {
		filter.CreatorID = &in.CreatorID
	}
	if in.GameID != 0 {
		filter.GameID = &in.GameID
	}
	return filter
}

type adminWalkthroughStatusInput struct {
	ID   int `path:"id"`
	Body struct {
		Status string `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	}
}

type adminWalkthroughCreatorDTO struct {
	userhttp.UserSummary
	Email string `json:"email"`
}

type adminWalkthroughGameDTO struct {
	ID      int    `json:"id"`
	TitleJP string `json:"title_jp"`
	TitleZH string `json:"title_zh"`
	TitleEN string `json:"title_en"`
}

type adminWalkthroughModerationDTO struct {
	ID          int       `json:"id"`
	Decision    string    `json:"decision" enum:"ALLOW,BLOCK,REVIEW"`
	Model       string    `json:"model"`
	TopCategory string    `json:"top_category"`
	MaxScore    *float64  `json:"max_score"`
	Reason      *string   `json:"reason,omitempty"`
	Evidence    *string   `json:"evidence,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type adminWalkthroughEventDTO struct {
	ID             int             `json:"id"`
	AuditBy        int             `json:"audit_by"`
	Model          string          `json:"model"`
	Decision       string          `json:"decision" enum:"ALLOW,BLOCK,REVIEW"`
	TopCategory    string          `json:"top_category"`
	CategoriesJSON json.RawMessage `json:"categories_json"`
	ScoresJSON     json.RawMessage `json:"scores_json"`
	MaxScore       *float64        `json:"max_score"`
	Reason         *string         `json:"reason,omitempty"`
	Evidence       *string         `json:"evidence,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

type adminWalkthroughItemDTO struct {
	ID         int                            `json:"id"`
	Title      string                         `json:"title"`
	HTML       string                         `json:"html"`
	Lang       *string                        `json:"lang"`
	Edited     bool                           `json:"edited"`
	Status     string                         `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Created    time.Time                      `json:"created"`
	Updated    time.Time                      `json:"updated"`
	Creator    adminWalkthroughCreatorDTO     `json:"creator"`
	Game       adminWalkthroughGameDTO        `json:"game"`
	Moderation *adminWalkthroughModerationDTO `json:"moderation,omitempty"`
}

type adminWalkthroughDetailDTO struct {
	ID          int                        `json:"id"`
	Title       string                     `json:"title"`
	HTML        string                     `json:"html"`
	Content     json.RawMessage            `json:"content"`
	Lang        *string                    `json:"lang"`
	Edited      bool                       `json:"edited"`
	Status      string                     `json:"status" enum:"DRAFT,PUBLISHED,HIDDEN,DELETED"`
	Created     time.Time                  `json:"created"`
	Updated     time.Time                  `json:"updated"`
	Creator     adminWalkthroughCreatorDTO `json:"creator"`
	Game        adminWalkthroughGameDTO    `json:"game"`
	Moderations []adminWalkthroughEventDTO `json:"moderations"`
}

func toAdminWalkthroughCreator(entry walkthrough.AdminEntry, now time.Time) adminWalkthroughCreatorDTO {
	return adminWalkthroughCreatorDTO{UserSummary: userhttp.ToUserSummary(entry.Creator, now), Email: entry.CreatorEmail}
}

func toAdminWalkthroughGame(ref walkthrough.GameRef) adminWalkthroughGameDTO {
	return adminWalkthroughGameDTO{ID: ref.ID, TitleJP: ref.TitleJP, TitleZH: ref.TitleZH, TitleEN: ref.TitleEN}
}

func toAdminWalkthroughModeration(event *moderation.Event) *adminWalkthroughModerationDTO {
	if event == nil {
		return nil
	}
	return &adminWalkthroughModerationDTO{
		ID:          event.ID,
		Decision:    string(event.Decision),
		Model:       event.Model,
		TopCategory: string(event.TopCategory),
		MaxScore:    event.MaxScore,
		Reason:      event.Reason,
		Evidence:    event.Evidence,
		CreatedAt:   event.Created,
	}
}

func toAdminWalkthroughEvent(event moderation.Event) adminWalkthroughEventDTO {
	return adminWalkthroughEventDTO{
		ID:             event.ID,
		AuditBy:        int(event.Auditor),
		Model:          event.Model,
		Decision:       string(event.Decision),
		TopCategory:    string(event.TopCategory),
		CategoriesJSON: event.Categories,
		ScoresJSON:     event.Scores,
		MaxScore:       event.MaxScore,
		Reason:         event.Reason,
		Evidence:       event.Evidence,
		CreatedAt:      event.Created,
	}
}

func toAdminWalkthroughItem(entry walkthrough.AdminEntry, now time.Time) adminWalkthroughItemDTO {
	return adminWalkthroughItemDTO{
		ID:         entry.ID,
		Title:      entry.Title,
		HTML:       entry.HTML,
		Lang:       entry.Lang,
		Edited:     entry.Edited,
		Status:     string(entry.Status),
		Created:    entry.Created,
		Updated:    entry.Updated,
		Creator:    toAdminWalkthroughCreator(entry, now),
		Game:       toAdminWalkthroughGame(entry.Game),
		Moderation: toAdminWalkthroughModeration(entry.Moderation),
	}
}

func toAdminWalkthroughDetail(detail walkthrough.AdminDetail, now time.Time) adminWalkthroughDetailDTO {
	events := make([]adminWalkthroughEventDTO, len(detail.Moderations))
	for i, event := range detail.Moderations {
		events[i] = toAdminWalkthroughEvent(event)
	}
	return adminWalkthroughDetailDTO{
		ID:          detail.ID,
		Title:       detail.Title,
		HTML:        detail.HTML,
		Content:     detail.Content,
		Lang:        detail.Lang,
		Edited:      detail.Edited,
		Status:      string(detail.Status),
		Created:     detail.Created,
		Updated:     detail.Updated,
		Creator:     toAdminWalkthroughCreator(detail.AdminEntry, now),
		Game:        toAdminWalkthroughGame(detail.Game),
		Moderations: events,
	}
}
