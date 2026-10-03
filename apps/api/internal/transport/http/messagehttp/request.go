package messagehttp

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type messagePathInput struct {
	ID int `path:"id" minimum:"1"`
}

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
