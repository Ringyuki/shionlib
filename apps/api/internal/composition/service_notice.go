package composition

import (
	"context"
	"fmt"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type NoticeService struct {
	messages Messenger
}

func NewNoticeService(messages Messenger) *NoticeService {
	return &NoticeService{messages: messages}
}

func (n *NoticeService) Done(ctx context.Context, composition Composition) error {
	key := "Done"
	if composition.Rebuild() {
		key = "Rebuilt"
	}
	return n.send(ctx, composition, key, message.ToneSuccess, message.Meta{})
}

func (n *NoticeService) Failed(ctx context.Context, composition Composition) error {
	reason := FailureInternal
	if composition.Failure != nil {
		reason = *composition.Failure
	}
	return n.send(ctx, composition, "Failed", message.ToneDestructive, message.Meta{"reason": reasonPrefix + strings.ToUpper(string(reason))})
}

func (n *NoticeService) send(ctx context.Context, composition Composition, key string, tone message.Tone, meta message.Meta) error {
	meta["composition_id"] = composition.ID
	meta["file_name"] = composition.OutputName
	if composition.OutputName == "" && composition.Patch != nil {
		meta["file_name"] = composition.Patch.Name
	}
	gameID := composition.GameID
	notice := message.NewMessage{
		Type:       message.TypeSystem,
		Tone:       tone,
		Title:      noticePrefix + key + "Title",
		Content:    noticePrefix + key + "Content",
		GameID:     &gameID,
		Meta:       meta,
		ReceiverID: composition.CreatorID,
	}
	if composition.ResourceID != nil {
		linkText, linkURL := noticeLinkText, fmt.Sprintf(resourcePath, *composition.ResourceID)
		notice.LinkText, notice.LinkURL = &linkText, &linkURL
		meta["resource_id"] = *composition.ResourceID
	}
	return n.messages.Send(ctx, notice)
}
