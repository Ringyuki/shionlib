package messagehttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type listMessagesInput struct {
	httpapi.PageQuery
	Unread string `query:"unread" enum:"true,false" doc:"Only unread (true) or only read (false) messages"`
	Type   string `query:"type" enum:"COMMENT_REPLY,COMMENT_LIKE,SYSTEM"`
}

func (in *listMessagesInput) filter() message.Filter {
	var filter message.Filter
	if in.Unread != "" {
		unread := in.Unread == "true"
		filter.Unread = &unread
	}
	if in.Type != "" {
		kind := message.Type(in.Type)
		filter.Type = &kind
	}
	return filter
}

type messagePath struct {
	ID int `path:"id" minimum:"1"`
}

type messageItemDTO struct {
	ID       int                   `json:"id"`
	Type     string                `json:"type" enum:"COMMENT_REPLY,COMMENT_LIKE,SYSTEM"`
	Tone     string                `json:"tone" enum:"PRIMARY,SECONDARY,SUCCESS,WARNING,INFO,DESTRUCTIVE,NEUTRAL"`
	Title    string                `json:"title"`
	Receiver userhttp.UserSummary  `json:"receiver"`
	Sender   *userhttp.UserSummary `json:"sender"`
	Read     bool                  `json:"read"`
	ReadAt   *time.Time            `json:"read_at"`
	Created  time.Time             `json:"created"`
	Updated  time.Time             `json:"updated"`
}

type messageCommentDTO struct {
	ID   int     `json:"id"`
	HTML *string `json:"html"`
}

type messageDetailDTO struct {
	ID           int                   `json:"id"`
	Type         string                `json:"type" enum:"COMMENT_REPLY,COMMENT_LIKE,SYSTEM"`
	Tone         string                `json:"tone" enum:"PRIMARY,SECONDARY,SUCCESS,WARNING,INFO,DESTRUCTIVE,NEUTRAL"`
	Title        string                `json:"title"`
	Content      string                `json:"content"`
	LinkText     *string               `json:"link_text"`
	LinkURL      *string               `json:"link_url"`
	ExternalLink bool                  `json:"external_link"`
	Meta         any                   `json:"meta"`
	Comment      *messageCommentDTO    `json:"comment"`
	Game         *gamehttp.GameCard    `json:"game"`
	Sender       *userhttp.UserSummary `json:"sender"`
	Receiver     userhttp.UserSummary  `json:"receiver"`
	Read         bool                  `json:"read"`
	ReadAt       *time.Time            `json:"read_at"`
	Created      time.Time             `json:"created"`
	Updated      time.Time             `json:"updated"`
}

func toMessageItem(m message.Message, now time.Time) messageItemDTO {
	return messageItemDTO{
		ID:       m.ID,
		Type:     string(m.Type),
		Tone:     string(m.Tone),
		Title:    m.Title,
		Receiver: userhttp.ToUserSummary(m.Receiver, now),
		Sender:   userhttp.ToUserSummaryPtr(m.Sender, now),
		Read:     m.Read,
		ReadAt:   m.ReadAt,
		Created:  m.Created,
		Updated:  m.Updated,
	}
}

func toMessageDetail(d message.Detail, now time.Time) messageDetailDTO {
	out := messageDetailDTO{
		ID:           d.ID,
		Type:         string(d.Type),
		Tone:         string(d.Tone),
		Title:        d.Title,
		Content:      d.Content,
		LinkText:     d.LinkText,
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
		out.Comment = &messageCommentDTO{ID: d.Comment.ID, HTML: d.Comment.HTML}
	}
	if d.Game != nil {
		card := gamehttp.ToGameCard(*d.Game)
		out.Game = &card
	}
	return out
}
