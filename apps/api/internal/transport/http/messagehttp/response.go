package messagehttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type messageItemDTO struct {
	ID       int                      `json:"id"`
	Type     string                   `json:"type" enum:"COMMENT_REPLY,COMMENT_LIKE,SYSTEM"`
	Tone     string                   `json:"tone" enum:"PRIMARY,SECONDARY,SUCCESS,WARNING,INFO,DESTRUCTIVE,NEUTRAL"`
	Title    string                   `json:"title" doc:"Written in the caller's language"`
	Excerpt  string                   `json:"excerpt" doc:"The beginning of the content, on one line"`
	Receiver userhttp.UserSummaryDTO  `json:"receiver"`
	Sender   *userhttp.UserSummaryDTO `json:"sender"`
	Read     bool                     `json:"read"`
	ReadAt   *time.Time               `json:"read_at"`
	Created  time.Time                `json:"created"`
	Updated  time.Time                `json:"updated"`
}

type messageCommentDTO struct {
	ID         int                  `json:"id"`
	Content    richtexthttp.Content `json:"content"`
	Text       string               `json:"text"`
	ResourceID *int                 `json:"resource_id" doc:"The download resource the comment was made on; null for a comment on the game itself"`
}

type messageDetailDTO struct {
	ID           int                      `json:"id"`
	Type         string                   `json:"type" enum:"COMMENT_REPLY,COMMENT_LIKE,SYSTEM"`
	Tone         string                   `json:"tone" enum:"PRIMARY,SECONDARY,SUCCESS,WARNING,INFO,DESTRUCTIVE,NEUTRAL"`
	Title        string                   `json:"title" doc:"Written in the caller's language"`
	Content      string                   `json:"content" doc:"Written in the caller's language"`
	LinkText     *string                  `json:"link_text" doc:"Written in the caller's language"`
	LinkURL      *string                  `json:"link_url"`
	ExternalLink bool                     `json:"external_link"`
	Meta         json.RawMessage          `json:"meta"`
	Comment      *messageCommentDTO       `json:"comment"`
	Game         *gamehttp.GameCardDTO    `json:"game"`
	Sender       *userhttp.UserSummaryDTO `json:"sender"`
	Receiver     userhttp.UserSummaryDTO  `json:"receiver"`
	Read         bool                     `json:"read"`
	ReadAt       *time.Time               `json:"read_at"`
	Created      time.Time                `json:"created"`
	Updated      time.Time                `json:"updated"`
}

func toMessageItem(m message.Message, text messageTextDTO, now time.Time) messageItemDTO {
	return messageItemDTO{
		ID:       m.ID,
		Type:     string(m.Type),
		Tone:     string(m.Tone),
		Title:    text.Title,
		Excerpt:  excerpt(text.Content),
		Receiver: userhttp.ToUserSummary(m.Receiver, now),
		Sender:   userhttp.ToUserSummaryPtr(m.Sender, now),
		Read:     m.Read,
		ReadAt:   m.ReadAt,
		Created:  m.Created,
		Updated:  m.Updated,
	}
}

func toMessageDetail(d message.Detail, text messageTextDTO, now time.Time) messageDetailDTO {
	out := messageDetailDTO{
		ID:           d.ID,
		Type:         string(d.Type),
		Tone:         string(d.Tone),
		Title:        text.Title,
		Content:      text.Content,
		LinkText:     text.LinkText,
		LinkURL:      d.LinkURL,
		ExternalLink: d.ExternalLink,
		Sender:       userhttp.ToUserSummaryPtr(d.Sender, now),
		Receiver:     userhttp.ToUserSummary(d.Receiver, now),
		Read:         d.Read,
		ReadAt:       d.ReadAt,
		Created:      d.Created,
		Updated:      d.Updated,
	}
	if len(d.Meta) > 0 {
		out.Meta = d.Meta
	}
	if d.Comment != nil {
		out.Comment = &messageCommentDTO{ID: d.Comment.ID, Content: richtexthttp.Content(d.Comment.Content), Text: d.Comment.Text, ResourceID: d.Comment.ResourceID}
	}
	if d.Game != nil {
		card := gamehttp.ToGameCard(*d.Game)
		out.Game = &card
	}
	return out
}

type messageUnreadEventDTO struct {
	Unread int `json:"unread" doc:"How many messages the caller has not read"`
}

type messageNewEventDTO struct {
	ID      int       `json:"id"`
	Type    string    `json:"type" enum:"COMMENT_REPLY,COMMENT_LIKE,SYSTEM"`
	Tone    string    `json:"tone" enum:"PRIMARY,SECONDARY,SUCCESS,WARNING,INFO,DESTRUCTIVE,NEUTRAL"`
	Created time.Time `json:"created"`
}
