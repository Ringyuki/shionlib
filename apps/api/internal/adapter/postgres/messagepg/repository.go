package messagepg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/comment"
	entmessage "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Create(ctx context.Context, in message.NewMessage) (message.Message, error) {
	create := r.db(ctx).Message.Create().
		SetType(entmessage.Type(in.Type)).
		SetTone(entmessage.Tone(in.Tone)).
		SetTitle(in.Title).
		SetContent(in.Content).
		SetNillableLinkText(in.LinkText).
		SetNillableLinkURL(in.LinkURL).
		SetExternalLink(in.ExternalLink).
		SetNillableCommentID(in.CommentID).
		SetNillableGameID(in.GameID).
		SetNillableSenderID(in.SenderID).
		SetReceiverID(in.ReceiverID)
	if len(in.Meta) > 0 {
		create.SetMeta(in.Meta)
	}
	row, err := create.Save(ctx)
	if err != nil {
		return message.Message{}, fmt.Errorf("create message: %w", err)
	}
	return toMessage(row), nil
}

func (r *Repository) Get(ctx context.Context, id int) (message.Stored, error) {
	row, err := r.db(ctx).Message.Query().
		Where(entmessage.ID(id)).
		WithSender(userpg.SelectSummary).
		WithReceiver(userpg.SelectSummary).
		WithComment(func(q *ent.CommentQuery) {
			q.Select(comment.FieldID, comment.FieldHTML)
		}).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return message.Stored{}, message.ErrNotFound
	}
	if err != nil {
		return message.Stored{}, fmt.Errorf("get message %d: %w", id, err)
	}
	stored := message.Stored{Message: toMessage(row)}
	if ref := row.Edges.Comment; ref != nil {
		stored.Comment = &message.CommentRef{ID: ref.ID, HTML: ref.HTML}
	}
	return stored, nil
}

func (r *Repository) List(ctx context.Context, receiverID int, filter message.Filter, page message.Page) ([]message.Message, int, error) {
	query := r.db(ctx).Message.Query().Where(entmessage.ReceiverID(receiverID))
	if filter.Unread != nil {
		query.Where(entmessage.Read(!*filter.Unread))
	}
	if filter.Type != nil {
		query.Where(entmessage.TypeEQ(entmessage.Type(*filter.Type)))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count messages: %w", err)
	}
	rows, err := query.
		WithSender(userpg.SelectSummary).
		WithReceiver(userpg.SelectSummary).
		Order(ent.Desc(entmessage.FieldCreated), ent.Desc(entmessage.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list messages: %w", err)
	}
	items := make([]message.Message, len(rows))
	for i, row := range rows {
		items[i] = toMessage(row)
	}
	return items, total, nil
}

func (r *Repository) CountUnread(ctx context.Context, receiverID int) (int, error) {
	count, err := r.db(ctx).Message.Query().Where(entmessage.ReceiverID(receiverID), entmessage.Read(false)).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count unread messages: %w", err)
	}
	return count, nil
}

func (r *Repository) MarkRead(ctx context.Context, id, receiverID int, at time.Time) error {
	affected, err := r.db(ctx).Message.Update().
		Where(entmessage.ID(id), entmessage.ReceiverID(receiverID)).
		SetRead(true).
		SetReadAt(at).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("mark message %d read: %w", id, err)
	}
	if affected == 0 {
		return message.ErrNotFound
	}
	return nil
}

func (r *Repository) MarkAllRead(ctx context.Context, receiverID int, at time.Time) error {
	if err := r.db(ctx).Message.Update().
		Where(entmessage.ReceiverID(receiverID), entmessage.Read(false)).
		SetRead(true).
		SetReadAt(at).
		Exec(ctx); err != nil {
		return fmt.Errorf("mark all messages read: %w", err)
	}
	return nil
}

func (r *Repository) MarkAllUnread(ctx context.Context, receiverID int) error {
	if err := r.db(ctx).Message.Update().
		Where(entmessage.ReceiverID(receiverID), entmessage.Read(true)).
		SetRead(false).
		ClearReadAt().
		Exec(ctx); err != nil {
		return fmt.Errorf("mark all messages unread: %w", err)
	}
	return nil
}

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
