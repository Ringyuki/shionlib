package moderation

import (
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

const (
	commentReplyTitle         = "Messages.Comment.Reply.Title"
	commentReplyContent       = "Messages.Comment.Reply.Content"
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
	ModeratorUserID *int
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

type commentBlockMeta struct {
	TopCategory Category `json:"top_category"`
	Reason      *string  `json:"reason,omitempty"`
	Evidence    *string  `json:"evidence,omitempty"`
}

func CommentBlockMessage(n CommentNotice, details BlockDetails) message.NewMessage {
	content := commentBlockContent
	if details.Reviewed {
		content = commentBlockReviewContent
	}
	meta, _ := json.Marshal(commentBlockMeta{TopCategory: details.TopCategory, Reason: details.Reason, Evidence: details.Evidence})
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

type walkthroughBlockMeta struct {
	TopCategory      Category `json:"top_category"`
	Reason           string   `json:"reason"`
	Evidence         string   `json:"evidence"`
	WalkthroughTitle string   `json:"walkthrough_title"`
	WalkthroughID    int      `json:"walkthrough_id"`
}

func walkthroughBlockMessage(subject WalkthroughSubject, verdict Verdict) message.NewMessage {
	meta, _ := json.Marshal(walkthroughBlockMeta{
		TopCategory:      verdict.TopCategory,
		Reason:           verdict.Reason,
		Evidence:         verdict.Evidence,
		WalkthroughTitle: subject.Title,
		WalkthroughID:    subject.ID,
	})
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
		Meta:       meta,
	}
}
