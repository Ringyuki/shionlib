package commenthttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type adminCommentCreatorDTO struct {
	userhttp.UserSummaryDTO
	Email string `json:"email"`
}

type adminCommentGameDTO struct {
	ID      int    `json:"id"`
	TitleJP string `json:"title_jp"`
	TitleZH string `json:"title_zh"`
	TitleEN string `json:"title_en"`
}

type adminCommentModerationDTO struct {
	ID          int       `json:"id"`
	Decision    string    `json:"decision" enum:"ALLOW,BLOCK,REVIEW"`
	Model       string    `json:"model"`
	TopCategory string    `json:"top_category"`
	MaxScore    *float64  `json:"max_score"`
	Reason      *string   `json:"reason,omitempty"`
	Evidence    *string   `json:"evidence,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type adminCommentEventDTO struct {
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

type adminCommentItemDTO struct {
	ID         int                        `json:"id"`
	HTML       *string                    `json:"html"`
	ParentID   *int                       `json:"parent_id"`
	RootID     *int                       `json:"root_id"`
	ReplyCount int                        `json:"reply_count"`
	LikeCount  int                        `json:"like_count"`
	Creator    adminCommentCreatorDTO     `json:"creator"`
	Parent     *commentParentDTO          `json:"parent"`
	Game       adminCommentGameDTO        `json:"game"`
	Edited     bool                       `json:"edited"`
	Status     int                        `json:"status"`
	Created    time.Time                  `json:"created"`
	Updated    time.Time                  `json:"updated"`
	Moderation *adminCommentModerationDTO `json:"moderation,omitempty"`
}

type adminCommentDetailDTO struct {
	ID          int                    `json:"id"`
	HTML        *string                `json:"html"`
	Content     json.RawMessage        `json:"content"`
	ParentID    *int                   `json:"parent_id"`
	RootID      *int                   `json:"root_id"`
	ReplyCount  int                    `json:"reply_count"`
	LikeCount   int                    `json:"like_count"`
	Creator     adminCommentCreatorDTO `json:"creator"`
	Parent      *commentParentDTO      `json:"parent"`
	Game        adminCommentGameDTO    `json:"game"`
	Edited      bool                   `json:"edited"`
	Status      int                    `json:"status"`
	Created     time.Time              `json:"created"`
	Updated     time.Time              `json:"updated"`
	Moderations []adminCommentEventDTO `json:"moderations"`
}

func toAdminCommentCreator(entry comment.AdminEntry, now time.Time) adminCommentCreatorDTO {
	return adminCommentCreatorDTO{UserSummaryDTO: userhttp.ToUserSummary(entry.Creator, now), Email: entry.CreatorEmail}
}

func toAdminCommentGame(ref comment.GameRef) adminCommentGameDTO {
	return adminCommentGameDTO{ID: ref.ID, TitleJP: ref.TitleJP, TitleZH: ref.TitleZH, TitleEN: ref.TitleEN}
}

func toAdminCommentModeration(event *moderation.Event) *adminCommentModerationDTO {
	if event == nil {
		return nil
	}
	return &adminCommentModerationDTO{
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

func toAdminCommentEvent(event moderation.Event) adminCommentEventDTO {
	return adminCommentEventDTO{
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

func toAdminCommentItem(entry comment.AdminEntry, now time.Time) adminCommentItemDTO {
	return adminCommentItemDTO{
		ID:         entry.ID,
		HTML:       entry.HTML,
		ParentID:   entry.ParentID,
		RootID:     entry.RootID,
		ReplyCount: entry.ReplyCount,
		LikeCount:  entry.LikeCount,
		Creator:    toAdminCommentCreator(entry, now),
		Parent:     toParent(entry.Parent, now),
		Game:       toAdminCommentGame(entry.Game),
		Edited:     entry.Edited,
		Status:     int(entry.Status),
		Created:    entry.Created,
		Updated:    entry.Updated,
		Moderation: toAdminCommentModeration(entry.Moderation),
	}
}

func toAdminCommentDetail(detail comment.AdminDetail, now time.Time) adminCommentDetailDTO {
	events := make([]adminCommentEventDTO, len(detail.Moderations))
	for i, event := range detail.Moderations {
		events[i] = toAdminCommentEvent(event)
	}
	return adminCommentDetailDTO{
		ID:          detail.ID,
		HTML:        detail.HTML,
		Content:     detail.Content,
		ParentID:    detail.ParentID,
		RootID:      detail.RootID,
		ReplyCount:  detail.ReplyCount,
		LikeCount:   detail.LikeCount,
		Creator:     toAdminCommentCreator(detail.AdminEntry, now),
		Parent:      toParent(detail.Parent, now),
		Game:        toAdminCommentGame(detail.Game),
		Edited:      detail.Edited,
		Status:      int(detail.Status),
		Created:     detail.Created,
		Updated:     detail.Updated,
		Moderations: events,
	}
}
