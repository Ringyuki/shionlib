package ai

import "slices"

type adaptation struct {
	route      RouteTarget
	label      string
	adjustment NewAdjustment
}

func adapt(route RouteTarget, failure *Failure, tried []Protocol) (adaptation, bool) {
	switch {
	case failure.Kind == ErrorProtocol && route.Connection.Kind == KindCompatible && route.Protocol.Generative():
		for _, protocol := range generativeProtocols {
			if slices.Contains(tried, protocol) {
				continue
			}
			previous := string(route.Protocol)
			next := route
			next.Protocol = protocol
			return adaptation{
				route:      next,
				label:      "protocol:" + string(protocol),
				adjustment: NewAdjustment{Kind: AdjustProtocol, Value: string(protocol), Previous: &previous, ErrorKind: failure.Kind},
			}, true
		}
	case failure.Kind == ErrorParam && failure.Param != "" && !route.Drops(failure.Param):
		next := route
		next.DroppedParams = append(slices.Clone(route.DroppedParams), failure.Param)
		return adaptation{
			route:      next,
			label:      "drop:" + failure.Param,
			adjustment: NewAdjustment{Kind: AdjustParam, Value: failure.Param, ErrorKind: failure.Kind},
		}, true
	case failure.Kind == ErrorStructured && !route.JSONMode && route.Protocol.Generative():
		next := route
		next.JSONMode = true
		return adaptation{
			route:      next,
			label:      "json_mode",
			adjustment: NewAdjustment{Kind: AdjustJSONMode, Value: "json", ErrorKind: failure.Kind},
		}, true
	}
	return adaptation{}, false
}

func revertAdjustment(route Route, adjustment Adjustment) RouteChanges {
	switch adjustment.Kind {
	case AdjustProtocol:
		protocol := ProtocolChat
		if adjustment.Previous != nil && Protocol(*adjustment.Previous).Valid() {
			protocol = Protocol(*adjustment.Previous)
		}
		return RouteChanges{Protocol: &protocol}
	case AdjustParam:
		params := slices.DeleteFunc(slices.Clone(route.DroppedParams), func(param string) bool { return param == adjustment.Value })
		return RouteChanges{DroppedParams: &params}
	default:
		off := false
		return RouteChanges{JSONMode: &off}
	}
}
