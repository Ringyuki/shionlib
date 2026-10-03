package messagepg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

func toMessage(row *ent.Message) message.Message {
	msg := message.Message{
		ID:           row.ID,
		Type:         message.Type(row.Type),
		Tone:         message.Tone(row.Tone),
		Title:        row.Title,
		Content:      row.Content,
		LinkText:     row.LinkText,
		LinkURL:      row.LinkURL,
		ExternalLink: row.ExternalLink,
		Meta:         row.Meta,
		CommentID:    row.CommentID,
		GameID:       row.GameID,
		Read:         row.Read,
		ReadAt:       row.ReadAt,
		Created:      row.Created,
		Updated:      row.Updated,
		Receiver:     userpg.ToSummary(row.Edges.Receiver),
		Sender:       userpg.ToSummaryPtr(row.Edges.Sender),
	}
	if row.Edges.Receiver == nil {
		msg.Receiver.ID = row.ReceiverID
	}
	return msg
}
