package ai

import "github.com/Ringyuki/shionlib/apps/api/internal/message"

const (
	routeSuspendedTitle   = "Messages.System.AI.RouteSuspended.Title"
	routeSuspendedContent = "Messages.System.AI.RouteSuspended.Content"
	routeRecoveredTitle   = "Messages.System.AI.RouteRecovered.Title"
	routeRecoveredContent = "Messages.System.AI.RouteRecovered.Content"
)

func routeStatusMessage(route Route, suspended bool, receiverID int) message.NewMessage {
	meta := message.Meta{
		"provider":    route.Provider.Name,
		"model":       route.Model.Name,
		"upstream_id": route.UpstreamID,
	}
	out := message.NewMessage{
		Type:       message.TypeSystem,
		Tone:       message.ToneSuccess,
		Title:      routeRecoveredTitle,
		Content:    routeRecoveredContent,
		Meta:       meta,
		ReceiverID: receiverID,
	}
	if suspended {
		out.Tone, out.Title, out.Content = message.ToneWarning, routeSuspendedTitle, routeSuspendedContent
		if route.StatusKind != nil {
			meta["error_kind"] = string(*route.StatusKind)
		}
		if route.StatusMessage != nil {
			meta["error_message"] = *route.StatusMessage
		}
	}
	return out
}
