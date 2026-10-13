package ai

import "testing"

func TestProtocolAdaptationWalksTheRemainingProtocols(t *testing.T) {
	route := RouteTarget{Connection: Connection{Kind: KindCompatible}, Protocol: ProtocolChat}
	failure := &Failure{Kind: ErrorProtocol}
	next, ok := adapt(route, failure, []Protocol{ProtocolChat, ProtocolResponses})
	if !ok || next.route.Protocol != ProtocolMessages || *next.adjustment.Previous != "chat" {
		t.Fatalf("next %+v", next)
	}
	if _, ok := adapt(route, failure, generativeProtocols); ok {
		t.Fatal("no protocols left")
	}
	native := RouteTarget{Connection: Connection{Kind: KindOpenAI}, Protocol: ProtocolResponses}
	if _, ok := adapt(native, failure, []Protocol{ProtocolResponses}); ok {
		t.Fatal("native providers keep their protocol")
	}
}

func TestParameterAndJSONAdaptationsHappenOnce(t *testing.T) {
	route := RouteTarget{Protocol: ProtocolChat, DroppedParams: []string{ParamTemperature}}
	if _, ok := adapt(route, &Failure{Kind: ErrorParam, Param: ParamTemperature}, nil); ok {
		t.Fatal("already dropped")
	}
	next, ok := adapt(route, &Failure{Kind: ErrorParam, Param: ParamMaxOutputTokens}, nil)
	if !ok || len(next.route.DroppedParams) != 2 || len(route.DroppedParams) != 1 {
		t.Fatalf("next %+v route %+v", next, route)
	}
	route.JSONMode = true
	if _, ok := adapt(route, &Failure{Kind: ErrorStructured}, nil); ok {
		t.Fatal("already in json mode")
	}
}
