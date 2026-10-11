package commenthttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type commentParentDTO struct {
	ID      int                     `json:"id"`
	Text    string                  `json:"text"`
	Creator userhttp.UserSummaryDTO `json:"creator"`
}

type userCommentParentDTO struct {
	ID      int                     `json:"id"`
	Content richtexthttp.Content    `json:"content"`
	Text    string                  `json:"text"`
	Creator userhttp.UserSummaryDTO `json:"creator"`
}

type commentCreatedDTO struct {
	ID        int                     `json:"id"`
	Content   richtexthttp.Content    `json:"content"`
	Text      string                  `json:"text"`
	ParentID  *int                    `json:"parent_id"`
	Parent    *commentParentDTO       `json:"parent"`
	RootID    *int                    `json:"root_id"`
	Creator   userhttp.UserSummaryDTO `json:"creator"`
	Status    int                     `json:"status"`
	Created   time.Time               `json:"created"`
	Updated   time.Time               `json:"updated"`
	LikeCount int                     `json:"like_count"`
}

type commentEditedDTO struct {
	ID       int                     `json:"id"`
	Content  richtexthttp.Content    `json:"content"`
	Text     string                  `json:"text"`
	ParentID *int                    `json:"parent_id"`
	RootID   *int                    `json:"root_id"`
	Creator  userhttp.UserSummaryDTO `json:"creator"`
	Edited   bool                    `json:"edited"`
	Status   int                     `json:"status"`
	Created  time.Time               `json:"created"`
	Updated  time.Time               `json:"updated"`
}

type commentRawDTO struct {
	ID        int                  `json:"id"`
	Content   richtexthttp.Content `json:"content"`
	CreatorID int                  `json:"creator_id"`
}

type commentItemParentDTO struct {
	ID      *int                     `json:"id"`
	Text    string                   `json:"text,omitempty"`
	Creator *userhttp.UserSummaryDTO `json:"creator,omitempty"`
}

type CommentItemDTO struct {
	ID         int                     `json:"id"`
	Content    richtexthttp.Content    `json:"content"`
	Text       string                  `json:"text"`
	ParentID   *int                    `json:"parent_id"`
	RootID     *int                    `json:"root_id"`
	ReplyCount int                     `json:"reply_count"`
	Parent     commentItemParentDTO    `json:"parent"`
	IsLiked    bool                    `json:"is_liked"`
	LikeCount  int                     `json:"like_count"`
	Creator    userhttp.UserSummaryDTO `json:"creator"`
	Edited     bool                    `json:"edited"`
	Status     int                     `json:"status"`
	Created    time.Time               `json:"created"`
	Updated    time.Time               `json:"updated"`
}

type commentThreadDTO struct {
	CommentItemDTO
	Replies []CommentItemDTO `json:"replies" doc:"Visible replies of the thread, oldest first, replies to replies included"`
}

type commentThreadPageMetaDTO struct {
	response.PageMeta
	Comments int `json:"comments" doc:"Visible comments of the game, replies included"`
}

type commentThreadPageDTO struct {
	Items []commentThreadDTO       `json:"items"`
	Meta  commentThreadPageMetaDTO `json:"meta"`
}

type userCommentDTO struct {
	ID         int                     `json:"id"`
	Content    richtexthttp.Content    `json:"content"`
	Text       string                  `json:"text"`
	ParentID   *int                    `json:"parent_id"`
	RootID     *int                    `json:"root_id"`
	ReplyCount int                     `json:"reply_count"`
	Parent     *userCommentParentDTO   `json:"parent"`
	IsLiked    bool                    `json:"is_liked"`
	LikeCount  int                     `json:"like_count"`
	Game       gamehttp.GameCardDTO    `json:"game"`
	Creator    userhttp.UserSummaryDTO `json:"creator"`
	Created    time.Time               `json:"created"`
	Updated    time.Time               `json:"updated"`
}

type userCommentPageMetaDTO struct {
	response.PageMeta
	IsCurrentUser bool `json:"is_current_user"`
}

type userCommentPageDTO struct {
	Items []userCommentDTO       `json:"items"`
	Meta  userCommentPageMetaDTO `json:"meta"`
}

func toParent(ref *comment.ParentRef, now time.Time) *commentParentDTO {
	if ref == nil {
		return nil
	}
	return &commentParentDTO{ID: ref.ID, Text: ref.Text, Creator: userhttp.ToUserSummary(ref.Creator, now)}
}

func toCreated(entry comment.Entry, now time.Time) commentCreatedDTO {
	rootID := entry.RootID
	if rootID == nil {
		rootID = &entry.ID
	}
	return commentCreatedDTO{
		ID:        entry.ID,
		Content:   richtexthttp.Content(entry.Content),
		Text:      entry.Text,
		ParentID:  entry.ParentID,
		Parent:    toParent(entry.Parent, now),
		RootID:    rootID,
		Creator:   userhttp.ToUserSummary(entry.Creator, now),
		Status:    int(entry.Status),
		Created:   entry.Created,
		Updated:   entry.Updated,
		LikeCount: entry.LikeCount,
	}
}

func toEdited(entry comment.Entry, now time.Time) commentEditedDTO {
	return commentEditedDTO{
		ID:       entry.ID,
		Content:  richtexthttp.Content(entry.Content),
		Text:     entry.Text,
		ParentID: entry.ParentID,
		RootID:   entry.RootID,
		Creator:  userhttp.ToUserSummary(entry.Creator, now),
		Edited:   entry.Edited,
		Status:   int(entry.Status),
		Created:  entry.Created,
		Updated:  entry.Updated,
	}
}

func toItem(entry comment.Entry, now time.Time) CommentItemDTO {
	parent := commentItemParentDTO{ID: entry.ParentID}
	if entry.Parent != nil {
		creator := userhttp.ToUserSummary(entry.Parent.Creator, now)
		parent.Text, parent.Creator = entry.Parent.Text, &creator
	}
	return CommentItemDTO{
		ID:         entry.ID,
		Content:    richtexthttp.Content(entry.Content),
		Text:       entry.Text,
		ParentID:   entry.ParentID,
		RootID:     entry.RootID,
		ReplyCount: entry.ReplyCount,
		Parent:     parent,
		IsLiked:    entry.Liked,
		LikeCount:  entry.LikeCount,
		Creator:    userhttp.ToUserSummary(entry.Creator, now),
		Edited:     entry.Edited,
		Status:     int(entry.Status),
		Created:    entry.Created,
		Updated:    entry.Updated,
	}
}

func toThread(thread comment.Thread, now time.Time) commentThreadDTO {
	replies := make([]CommentItemDTO, len(thread.Replies))
	for i, reply := range thread.Replies {
		replies[i] = toItem(reply, now)
	}
	return commentThreadDTO{CommentItemDTO: toItem(thread.Entry, now), Replies: replies}
}

func toQuotedParent(ref *comment.ParentRef, now time.Time) *userCommentParentDTO {
	if ref == nil {
		return nil
	}
	return &userCommentParentDTO{ID: ref.ID, Content: richtexthttp.Content(ref.Content), Text: ref.Text, Creator: userhttp.ToUserSummary(ref.Creator, now)}
}

func toUserComment(entry comment.Entry, now time.Time) userCommentDTO {
	out := userCommentDTO{
		ID:         entry.ID,
		Content:    richtexthttp.Content(entry.Content),
		Text:       entry.Text,
		ParentID:   entry.ParentID,
		RootID:     entry.RootID,
		ReplyCount: entry.ReplyCount,
		Parent:     toQuotedParent(entry.Parent, now),
		IsLiked:    entry.Liked,
		LikeCount:  entry.LikeCount,
		Creator:    userhttp.ToUserSummary(entry.Creator, now),
		Created:    entry.Created,
		Updated:    entry.Updated,
	}
	if entry.Game != nil {
		out.Game = gamehttp.ToGameCard(*entry.Game)
	}
	return out
}
