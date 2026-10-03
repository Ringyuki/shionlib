package commenthttp

import (
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/lexicalhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/userhttp"
)

type commentPath struct {
	CommentID int `path:"comment_id"`
}

type createCommentInput struct {
	GameID int `path:"game_id"`
	Body   struct {
		Content  json.RawMessage `json:"content" doc:"Lexical editor state"`
		ParentID *int            `json:"parent_id,omitempty"`
	}
	document lexical.Document
}

func (in *createCommentInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = lexicalhttp.Parse(in.Body.Content, comment.MaxContentLength)
	return errs
}

type editCommentInput struct {
	CommentID int `path:"comment_id"`
	Body      struct {
		Content json.RawMessage `json:"content" doc:"Lexical editor state"`
	}
	document lexical.Document
}

func (in *editCommentInput) Resolve(huma.Context) []error {
	var errs []error
	in.document, errs = lexicalhttp.Parse(in.Body.Content, comment.MaxContentLength)
	return errs
}

type gameCommentsInput struct {
	GameID int `path:"game_id"`
	httpapi.PageQuery
}

type userCommentsInput struct {
	ID int `path:"id"`
	httpapi.PageQuery
}

type commentParentDTO struct {
	ID      int                  `json:"id"`
	HTML    *string              `json:"html"`
	Creator userhttp.UserSummary `json:"creator"`
}

type commentCreatedDTO struct {
	ID        int                  `json:"id"`
	Content   json.RawMessage      `json:"content"`
	HTML      *string              `json:"html"`
	ParentID  *int                 `json:"parent_id"`
	Parent    *commentParentDTO    `json:"parent"`
	RootID    *int                 `json:"root_id"`
	Creator   userhttp.UserSummary `json:"creator"`
	Status    int                  `json:"status"`
	Created   time.Time            `json:"created"`
	Updated   time.Time            `json:"updated"`
	LikeCount int                  `json:"like_count"`
}

type commentEditedDTO struct {
	ID       int                  `json:"id"`
	Content  json.RawMessage      `json:"content"`
	HTML     *string              `json:"html"`
	ParentID *int                 `json:"parent_id"`
	RootID   *int                 `json:"root_id"`
	Creator  userhttp.UserSummary `json:"creator"`
	Edited   bool                 `json:"edited"`
	Status   int                  `json:"status"`
	Created  time.Time            `json:"created"`
	Updated  time.Time            `json:"updated"`
}

type commentRawDTO struct {
	ID        int             `json:"id"`
	Content   json.RawMessage `json:"content"`
	CreatorID int             `json:"creator_id"`
}

type commentItemParentDTO struct {
	ID      *int                  `json:"id"`
	HTML    *string               `json:"html,omitempty"`
	Creator *userhttp.UserSummary `json:"creator,omitempty"`
}

type commentItemDTO struct {
	ID         int                  `json:"id"`
	HTML       *string              `json:"html"`
	ParentID   *int                 `json:"parent_id"`
	RootID     *int                 `json:"root_id"`
	ReplyCount int                  `json:"reply_count"`
	Parent     commentItemParentDTO `json:"parent"`
	IsLiked    bool                 `json:"is_liked"`
	LikeCount  int                  `json:"like_count"`
	Creator    userhttp.UserSummary `json:"creator"`
	Edited     bool                 `json:"edited"`
	Status     int                  `json:"status"`
	Created    time.Time            `json:"created"`
	Updated    time.Time            `json:"updated"`
}

type userCommentDTO struct {
	ID         int                  `json:"id"`
	HTML       *string              `json:"html"`
	ParentID   *int                 `json:"parent_id"`
	RootID     *int                 `json:"root_id"`
	ReplyCount int                  `json:"reply_count"`
	Parent     *commentParentDTO    `json:"parent"`
	IsLiked    bool                 `json:"is_liked"`
	LikeCount  int                  `json:"like_count"`
	Game       gamehttp.GameCard    `json:"game"`
	Creator    userhttp.UserSummary `json:"creator"`
	Created    time.Time            `json:"created"`
	Updated    time.Time            `json:"updated"`
}

type userCommentPageMeta struct {
	response.PageMeta
	IsCurrentUser bool `json:"is_current_user"`
}

type userCommentPageDTO struct {
	Items []userCommentDTO    `json:"items"`
	Meta  userCommentPageMeta `json:"meta"`
}

func toParent(ref *comment.ParentRef, now time.Time) *commentParentDTO {
	if ref == nil {
		return nil
	}
	return &commentParentDTO{ID: ref.ID, HTML: ref.HTML, Creator: userhttp.ToUserSummary(ref.Creator, now)}
}

func toCreated(entry comment.Entry, now time.Time) commentCreatedDTO {
	rootID := entry.RootID
	if rootID == nil {
		rootID = &entry.ID
	}
	return commentCreatedDTO{
		ID:        entry.ID,
		Content:   entry.Content,
		HTML:      entry.HTML,
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
		Content:  entry.Content,
		HTML:     entry.HTML,
		ParentID: entry.ParentID,
		RootID:   entry.RootID,
		Creator:  userhttp.ToUserSummary(entry.Creator, now),
		Edited:   entry.Edited,
		Status:   int(entry.Status),
		Created:  entry.Created,
		Updated:  entry.Updated,
	}
}

func toItem(entry comment.Entry, now time.Time) commentItemDTO {
	parent := commentItemParentDTO{ID: entry.ParentID}
	if entry.Parent != nil {
		creator := userhttp.ToUserSummary(entry.Parent.Creator, now)
		parent.HTML, parent.Creator = entry.Parent.HTML, &creator
	}
	return commentItemDTO{
		ID:         entry.ID,
		HTML:       entry.HTML,
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

func toUserComment(entry comment.Entry, now time.Time) userCommentDTO {
	out := userCommentDTO{
		ID:         entry.ID,
		HTML:       entry.HTML,
		ParentID:   entry.ParentID,
		RootID:     entry.RootID,
		ReplyCount: entry.ReplyCount,
		Parent:     toParent(entry.Parent, now),
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
