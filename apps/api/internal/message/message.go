package message

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type Type string

const (
	TypeCommentReply Type = "COMMENT_REPLY"
	TypeCommentLike  Type = "COMMENT_LIKE"
	TypeSystem       Type = "SYSTEM"
)

func (t Type) Valid() bool {
	return t == TypeCommentReply || t == TypeCommentLike || t == TypeSystem
}

type Tone string

const (
	TonePrimary     Tone = "PRIMARY"
	ToneSecondary   Tone = "SECONDARY"
	ToneSuccess     Tone = "SUCCESS"
	ToneWarning     Tone = "WARNING"
	ToneInfo        Tone = "INFO"
	ToneDestructive Tone = "DESTRUCTIVE"
	ToneNeutral     Tone = "NEUTRAL"
)

const (
	MaxTitleLength   = 255
	MaxContentLength = 10240
	MaxLinkLength    = 255
)

type Message struct {
	ID           int
	Type         Type
	Tone         Tone
	Title        string
	Content      string
	LinkText     *string
	LinkURL      *string
	ExternalLink bool
	Meta         json.RawMessage
	CommentID    *int
	GameID       *int
	Sender       *user.Summary
	Receiver     user.Summary
	Read         bool
	ReadAt       *time.Time
	Created      time.Time
	Updated      time.Time
}

type CommentRef struct {
	ID   int
	HTML *string
}

type Detail struct {
	Message
	Comment *CommentRef
	Game    *game.Card
}

type Stored struct {
	Message
	Comment *CommentRef
}

type NewMessage struct {
	Type         Type
	Tone         Tone
	Title        string
	Content      string
	LinkText     *string
	LinkURL      *string
	ExternalLink bool
	Meta         json.RawMessage
	CommentID    *int
	GameID       *int
	SenderID     *int
	ReceiverID   int
}

type Notice struct {
	ID      int       `json:"id"`
	Title   string    `json:"title"`
	Type    Type      `json:"type"`
	Tone    Tone      `json:"tone"`
	Created time.Time `json:"created"`
}

type Filter struct {
	Unread *bool
	Type   *Type
}

type Page struct {
	Number int
	Size   int
}

func (p Page) Offset() int {
	return (p.Number - 1) * p.Size
}
