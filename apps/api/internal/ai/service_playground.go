package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

type PlaygroundService struct {
	gateway  *Service
	requests RequestLog
	newID    func() string
}

func NewPlaygroundService(gateway *Service, requests RequestLog, newID func() string) *PlaygroundService {
	return &PlaygroundService{gateway: gateway, requests: requests, newID: newID}
}

func (s *PlaygroundService) Run(ctx context.Context, run PlaygroundRun) ([]PlaygroundResult, error) {
	if len(run.Schema) > 0 && !jsonObject(run.Schema) {
		return nil, ErrSchemaInvalid
	}
	for _, target := range run.Targets {
		if !s.known(target) {
			return nil, ErrPlaygroundTarget
		}
	}
	results := make([]PlaygroundResult, len(run.Targets))
	for i, target := range run.Targets {
		callID := s.newID()
		output, err := s.execute(ctx, target, run, callID)
		result := PlaygroundResult{OK: err == nil, Output: output}
		if err != nil {
			failure, ok := playgroundFailure(err)
			if !ok {
				return nil, err
			}
			result.Failure = failure
		}
		attempts, err := s.requests.Attempts(ctx, callID)
		if err != nil {
			return nil, err
		}
		result.Attempts = attempts
		results[i] = result
	}
	return results, nil
}

func (s *PlaygroundService) known(target PlaygroundTarget) bool {
	switch target.Kind {
	case PlaygroundScene:
		_, ok := s.gateway.Scene(target.ID)
		return ok
	case PlaygroundModel, PlaygroundRoute:
		id, err := strconv.Atoi(target.ID)
		return err == nil && id > 0
	}
	return false
}

func (s *PlaygroundService) resolve(ctx context.Context, target PlaygroundTarget) (Target, error) {
	if target.Kind == PlaygroundScene {
		return s.gateway.SceneTarget(ctx, target.ID, SourcePlayground)
	}
	id, err := strconv.Atoi(target.ID)
	if err != nil {
		return Target{}, ErrPlaygroundTarget
	}
	if target.Kind == PlaygroundModel {
		return s.gateway.ModelTarget(ctx, id, SourcePlayground)
	}
	return s.gateway.RouteTarget(ctx, id, SourcePlayground)
}

func (s *PlaygroundService) execute(ctx context.Context, playgroundTarget PlaygroundTarget, run PlaygroundRun, callID string) (*string, error) {
	target, err := s.resolve(ctx, playgroundTarget)
	if err != nil {
		return nil, err
	}
	var output string
	switch {
	case target.Model.Moderation:
		result, err := s.gateway.RunModeration(ctx, target, ModerationRequest{Input: run.Prompt.LastUserMessage(), CallID: callID})
		if err != nil {
			return nil, err
		}
		output = indentJSON(json.RawMessage(`{"categories":` + string(result.Categories) + `,"scores":` + string(result.Scores) + `}`))
	case len(run.Schema) > 0:
		result, err := s.gateway.RunObject(ctx, target, ObjectRequest{Prompt: run.Prompt, Schema: run.Schema, SchemaName: "playground", Temperature: run.Temperature, MaxOutputTokens: run.MaxOutputTokens, CallID: callID})
		if err != nil {
			return nil, err
		}
		output = indentJSON(result.Output)
	default:
		result, err := s.gateway.RunText(ctx, target, TextRequest{Prompt: run.Prompt, Temperature: run.Temperature, MaxOutputTokens: run.MaxOutputTokens, CallID: callID})
		if err != nil {
			return nil, err
		}
		output = result.Text
	}
	return &output, nil
}

func playgroundFailure(err error) (*Failure, bool) {
	if failure, ok := upstreamFailure(err); ok {
		return failure, true
	}
	if _, ok := apperror.From(err); ok {
		return &Failure{Kind: ErrorOther, Message: err.Error()}, true
	}
	return nil, false
}

func indentJSON(raw json.RawMessage) string {
	var out bytes.Buffer
	if err := json.Indent(&out, raw, "", "  "); err != nil {
		return string(raw)
	}
	return out.String()
}
