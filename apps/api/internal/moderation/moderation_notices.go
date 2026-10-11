package moderation

import (
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

const (
	commentReplyTitle         = "Messages.Comment.Reply.Title"
	commentReplyContent       = "Messages.Comment.Reply.Content"
	resourceCommentTitle      = "Messages.Comment.Resource.Title"
	resourceCommentContent    = "Messages.Comment.Resource.Content"
	commentBlockTitle         = "Messages.System.Moderation.Comment.Block.Title"
	commentBlockContent       = "Messages.System.Moderation.Comment.Block.Content"
	commentBlockReviewContent = "Messages.System.Moderation.Comment.Block.ReviewContent"
	walkthroughBlockTitle     = "Messages.System.Moderation.Walkthrough.Block.Title"
	walkthroughBlockContent   = "Messages.System.Moderation.Walkthrough.Block.ReviewContent"
	walkthroughBlockLinkText  = "Messages.System.Moderation.Walkthrough.Block.LinkText"
)

type CommentNotice struct {
	CommentID       int
	GameID          int
	AuthorID        int
	ParentAuthorID  int
	PublisherID     int
	ModeratorUserID *int
}

func ResourceCommentMessage(n CommentNotice) message.NewMessage {
	return message.NewMessage{
		Type:       message.TypeCommentReply,
		Tone:       message.ToneInfo,
		Title:      resourceCommentTitle,
		Content:    resourceCommentContent,
		ReceiverID: n.PublisherID,
		CommentID:  &n.CommentID,
		GameID:     &n.GameID,
		SenderID:   &n.AuthorID,
	}
}

func CommentReplyMessage(n CommentNotice) message.NewMessage {
	return message.NewMessage{
		Type:       message.TypeCommentReply,
		Tone:       message.ToneInfo,
		Title:      commentReplyTitle,
		Content:    commentReplyContent,
		ReceiverID: n.ParentAuthorID,
		CommentID:  &n.CommentID,
		GameID:     &n.GameID,
		SenderID:   &n.AuthorID,
	}
}

type BlockDetails struct {
	TopCategory Category
	Reason      *string
	Evidence    *string
	Reviewed    bool
}

func CommentBlockMessage(n CommentNotice, details BlockDetails) message.NewMessage {
	content := commentBlockContent
	if details.Reviewed {
		content = commentBlockReviewContent
	}
	meta := message.Meta{"top_category": details.TopCategory}
	if details.Reason != nil {
		meta["reason"] = *details.Reason
	}
	if details.Evidence != nil {
		meta["evidence"] = *details.Evidence
	}
	return message.NewMessage{
		Type:       message.TypeSystem,
		Tone:       message.ToneDestructive,
		Title:      commentBlockTitle,
		Content:    content,
		ReceiverID: n.AuthorID,
		CommentID:  &n.CommentID,
		GameID:     &n.GameID,
		SenderID:   n.ModeratorUserID,
		Meta:       meta,
	}
}

func walkthroughBlockMessage(subject WalkthroughSubject, verdict Verdict) message.NewMessage {
	linkText := walkthroughBlockLinkText
	linkURL := fmt.Sprintf("/game/%d/walkthrough/%d", subject.GameID, subject.ID)
	gameID := subject.GameID
	return message.NewMessage{
		Type:       message.TypeSystem,
		Tone:       message.ToneDestructive,
		Title:      walkthroughBlockTitle,
		Content:    walkthroughBlockContent,
		LinkText:   &linkText,
		LinkURL:    &linkURL,
		ReceiverID: subject.CreatorID,
		GameID:     &gameID,
		Meta: message.Meta{
			"top_category":   verdict.TopCategory,
			"reason":         verdict.Reason,
			"evidence":       verdict.Evidence,
			"walkthrough_id": subject.ID,
			"game_title_jp":  subject.Game.JP,
			"game_title_zh":  subject.Game.ZH,
			"game_title_en":  subject.Game.EN,
		},
	}
}
