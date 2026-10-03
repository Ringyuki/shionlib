package ai

type RouteStatusNotice struct {
	RouteID   int  `json:"route_id"`
	Suspended bool `json:"suspended"`
}

func (RouteStatusNotice) Kind() string {
	return "ai_route_status"
}
