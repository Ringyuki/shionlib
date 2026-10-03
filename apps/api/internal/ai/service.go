package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sync"
	"time"
)

type Options struct {
	IdleTimeout    time.Duration
	RecordPayloads bool
}

type Deps struct {
	Scenes   []SceneDefinition
	Repo     Repository
	Requests RequestLog
	Upstream Upstream
	Queue    Queue
	Now      func() time.Time
	NewID    func() string
	Options  Options
}

type Service struct {
	scenes   []SceneDefinition
	repo     Repository
	requests RequestLog
	upstream Upstream
	queue    Queue
	now      func() time.Time
	newID    func() string
	options  Options
	mu       sync.Mutex
	failures map[int]routeFailures
}

func NewService(deps Deps) *Service {
	return &Service{
		scenes:   slices.Clone(deps.Scenes),
		repo:     deps.Repo,
		requests: deps.Requests,
		upstream: deps.Upstream,
		queue:    deps.Queue,
		now:      deps.Now,
		newID:    deps.NewID,
		options:  deps.Options,
		failures: map[int]routeFailures{},
	}
}

func (s *Service) Scenes() []SceneDefinition {
	return slices.Clone(s.scenes)
}

func (s *Service) Scene(key string) (SceneDefinition, bool) {
	for _, scene := range s.scenes {
		if scene.Key == key {
			return scene, true
		}
	}
	return SceneDefinition{}, false
}

func (s *Service) Object(ctx context.Context, scene string, request ObjectRequest) (ObjectResult, error) {
	target, err := s.SceneTarget(ctx, scene, SourceScene)
	if err != nil {
		return ObjectResult{}, err
	}
	return s.RunObject(ctx, target, request)
}

func (s *Service) Text(ctx context.Context, scene string, request TextRequest) (TextResult, error) {
	target, err := s.SceneTarget(ctx, scene, SourceScene)
	if err != nil {
		return TextResult{}, err
	}
	return s.RunText(ctx, target, request)
}

func (s *Service) Moderate(ctx context.Context, scene string, request ModerationRequest) (ModerationResult, error) {
	target, err := s.SceneTarget(ctx, scene, SourceScene)
	if err != nil {
		return ModerationResult{}, err
	}
	return s.RunModeration(ctx, target, request)
}

func (s *Service) SceneTarget(ctx context.Context, key string, source Source) (Target, error) {
	definition, ok := s.Scene(key)
	if !ok {
		return Target{}, ErrSceneNotFound
	}
	config, _, err := s.repo.SceneConfig(ctx, key)
	if err != nil {
		return Target{}, err
	}
	modelID := config.ModelID
	if modelID == nil {
		if modelID, err = s.repo.DefaultModelID(ctx); err != nil {
			return Target{}, err
		}
	}
	if modelID == nil {
		return Target{}, ErrSceneNotConfigured.Wrap(fmt.Errorf("scene %s has no model", key))
	}
	model, routes, err := s.repo.ModelTarget(ctx, *modelID)
	if errors.Is(err, ErrModelNotFound) {
		return Target{}, ErrSceneNotConfigured.Wrap(err)
	}
	if err != nil {
		return Target{}, err
	}
	if problem := sceneProblem(definition, &SceneModel{ModelRef: ModelRef{ID: model.ID, Key: model.Key, Name: model.Name, Moderation: model.Moderation}, Enabled: model.Enabled, ActiveRoutes: len(routes)}); problem != nil {
		return Target{}, ErrSceneNotConfigured.Wrap(fmt.Errorf("scene %s: %s", key, *problem))
	}
	timeout := s.options.IdleTimeout
	if config.Timeout != nil {
		timeout = *config.Timeout
	}
	return Target{
		Scene:           &key,
		Source:          source,
		Model:           model,
		Routes:          routes,
		Temperature:     config.Temperature,
		MaxOutputTokens: config.MaxOutputTokens,
		IdleTimeout:     timeout,
	}, nil
}

func (s *Service) ModelTarget(ctx context.Context, id int, source Source) (Target, error) {
	model, routes, err := s.repo.ModelTarget(ctx, id)
	if err != nil {
		return Target{}, err
	}
	return Target{Source: source, Model: model, Routes: routes, IdleTimeout: s.options.IdleTimeout}, nil
}

func (s *Service) RouteTarget(ctx context.Context, id int, source Source) (Target, error) {
	model, route, err := s.repo.RouteTarget(ctx, id)
	if err != nil {
		return Target{}, err
	}
	return Target{Source: source, Model: model, Routes: []RouteTarget{route}, IdleTimeout: s.options.IdleTimeout}, nil
}

func (s *Service) RunObject(ctx context.Context, target Target, request ObjectRequest) (ObjectResult, error) {
	if target.Model.Moderation {
		return ObjectResult{}, ErrSceneModelMismatch
	}
	if !jsonObject(request.Schema) {
		return ObjectResult{}, ErrSchemaInvalid
	}
	payload := Payload{System: request.System, Messages: request.Messages, Schema: request.Schema}
	var output json.RawMessage
	route, completion, err := s.run(ctx, target, request.CallID, payload, func(ctx context.Context, route RouteTarget) (Completion, error) {
		completion, err := s.upstream.Generate(ctx, s.generation(target, route, request.Prompt, request.Temperature, request.MaxOutputTokens, request.Schema, request.SchemaName))
		if err != nil {
			return completion, err
		}
		parsed, ok := extractJSON(completion.Text)
		if !ok {
			return completion, malformedOutput(completion)
		}
		output = parsed
		return completion, nil
	})
	if err != nil {
		return ObjectResult{}, err
	}
	return ObjectResult{Model: route.UpstreamID, Output: output, Usage: completion.Usage}, nil
}

func (s *Service) RunText(ctx context.Context, target Target, request TextRequest) (TextResult, error) {
	if target.Model.Moderation {
		return TextResult{}, ErrSceneModelMismatch
	}
	payload := Payload{System: request.System, Messages: request.Messages}
	route, completion, err := s.run(ctx, target, request.CallID, payload, func(ctx context.Context, route RouteTarget) (Completion, error) {
		completion, err := s.upstream.Generate(ctx, s.generation(target, route, request.Prompt, request.Temperature, request.MaxOutputTokens, nil, ""))
		if err != nil {
			return completion, err
		}
		completion.Text = stripReasoning(completion.Text)
		return completion, nil
	})
	if err != nil {
		return TextResult{}, err
	}
	return TextResult{Model: route.UpstreamID, Text: completion.Text, Usage: completion.Usage}, nil
}

func (s *Service) RunModeration(ctx context.Context, target Target, request ModerationRequest) (ModerationResult, error) {
	if !target.Model.Moderation {
		return ModerationResult{}, ErrSceneModelMismatch
	}
	payload := Payload{Messages: []Message{{Role: RoleUser, Content: request.Input}}}
	var classified Classified
	route, _, err := s.run(ctx, target, request.CallID, payload, func(ctx context.Context, route RouteTarget) (Completion, error) {
		result, err := s.upstream.Classify(ctx, Classification{Route: route, Input: request.Input, IdleTimeout: target.IdleTimeout})
		if err != nil {
			return Completion{}, err
		}
		classified = result
		return Completion{Text: string(result.Scores), FinishReason: FinishStop, Usage: result.Usage}, nil
	})
	if err != nil {
		return ModerationResult{}, err
	}
	return ModerationResult{Model: route.UpstreamID, Categories: classified.Categories, Scores: classified.Scores}, nil
}

func (s *Service) generation(target Target, route RouteTarget, prompt Prompt, temperature *float64, maxOutputTokens *int, schema json.RawMessage, schemaName string) Generation {
	if target.Temperature != nil {
		temperature = target.Temperature
	}
	if !target.Model.Temperature {
		temperature = nil
	}
	if target.MaxOutputTokens != nil {
		maxOutputTokens = target.MaxOutputTokens
	}
	if maxOutputTokens == nil && route.Protocol == ProtocolMessages {
		maxOutputTokens = target.Model.OutputLimit
	}
	return Generation{
		Route:           route,
		Prompt:          prompt,
		Schema:          schema,
		SchemaName:      schemaName,
		Temperature:     temperature,
		MaxOutputTokens: maxOutputTokens,
		IdleTimeout:     target.IdleTimeout,
	}
}

func (s *Service) run(ctx context.Context, target Target, callID string, payload Payload, call func(ctx context.Context, route RouteTarget) (Completion, error)) (RouteTarget, Completion, error) {
	if len(target.Routes) == 0 {
		return RouteTarget{}, Completion{}, ErrUnavailable.Wrap(&Failure{Kind: ErrorOther, Message: "no active route"})
	}
	if callID == "" {
		callID = s.newID()
	}
	var last *Failure
	for _, original := range s.ordered(target.Routes) {
		route := original
		tried := []Protocol{route.Protocol}
		var adjustments []NewAdjustment
		for adaptations := 0; ; adaptations++ {
			started := s.now()
			completion, err := call(ctx, route)
			attempt := attemptRecord{target: target, route: route, callID: callID, started: started, duration: s.now().Sub(started), completion: completion, payload: payload}
			if err == nil {
				if _, err := s.record(ctx, attempt); err != nil {
					return RouteTarget{}, Completion{}, err
				}
				s.clearFailures(route.ID)
				if len(adjustments) > 0 {
					if err := s.persistAdaptation(ctx, route, adjustments); err != nil {
						return RouteTarget{}, Completion{}, err
					}
				}
				return route, completion, nil
			}
			failure := failureOf(err)
			attempt.failure = failure
			if ctx.Err() != nil {
				if _, recordErr := s.record(context.WithoutCancel(ctx), attempt); recordErr != nil {
					return RouteTarget{}, Completion{}, errors.Join(ctx.Err(), recordErr)
				}
				return RouteTarget{}, Completion{}, ctx.Err()
			}
			next, adapted := adaptation{}, false
			if adaptations < maxAdaptations {
				next, adapted = adapt(route, failure, tried)
			}
			if adapted {
				attempt.adaptation = &next.label
			}
			requestID, err := s.record(ctx, attempt)
			if err != nil {
				return RouteTarget{}, Completion{}, err
			}
			if adapted {
				next.adjustment.RequestID = &requestID
				adjustments = append(adjustments, next.adjustment)
				route = next.route
				tried = append(tried, route.Protocol)
				continue
			}
			if err := s.suspend(ctx, route, failure); err != nil {
				return RouteTarget{}, Completion{}, err
			}
			if failure.Kind.OutputProblem() {
				return RouteTarget{}, Completion{}, ErrOutputMalformed.Wrap(failure)
			}
			s.noteFailure(route.ID)
			last = failure
			break
		}
	}
	return RouteTarget{}, Completion{}, ErrUnavailable.Wrap(last)
}

func (s *Service) ordered(routes []RouteTarget) []RouteTarget {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	ready := make([]RouteTarget, 0, len(routes))
	var cooling []RouteTarget
	for _, route := range routes {
		if s.failures[route.ID].until.After(now) {
			cooling = append(cooling, route)
			continue
		}
		ready = append(ready, route)
	}
	return append(ready, cooling...)
}

func (s *Service) noteFailure(routeID int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state := s.failures[routeID]
	state.count++
	if state.count >= cooldownFailures {
		state.until = s.now().Add(cooldownPeriod)
	}
	s.failures[routeID] = state
}

func (s *Service) clearFailures(routeID int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.failures, routeID)
}

func (s *Service) suspend(ctx context.Context, route RouteTarget, failure *Failure) error {
	if !failure.Kind.Suspends() {
		return nil
	}
	changed, err := s.repo.SuspendRoute(ctx, route.ID, *failure, s.now())
	if err != nil || !changed {
		return err
	}
	return s.queue.Enqueue(ctx, RouteStatusNotice{RouteID: route.ID, Suspended: true})
}

func (s *Service) persistAdaptation(ctx context.Context, route RouteTarget, adjustments []NewAdjustment) error {
	params := slices.Clone(route.DroppedParams)
	if err := s.repo.UpdateRoute(ctx, route.ID, RouteChanges{Protocol: &route.Protocol, DroppedParams: &params, JSONMode: &route.JSONMode}); err != nil {
		return err
	}
	return s.repo.SaveAdjustments(ctx, route.ID, adjustments)
}

func (s *Service) record(ctx context.Context, attempt attemptRecord) (int64, error) {
	modelID, routeID, providerID := attempt.target.Model.ID, attempt.route.ID, attempt.route.ProviderID
	record := RequestRecord{
		CallID:     attempt.callID,
		Source:     attempt.target.Source,
		Scene:      attempt.target.Scene,
		ModelID:    &modelID,
		RouteID:    &routeID,
		ProviderID: &providerID,
		UpstreamID: attempt.route.UpstreamID,
		Protocol:   attempt.route.Protocol,
		OK:         attempt.failure == nil,
		Failure:    attempt.failure,
		Adaptation: attempt.adaptation,
		Duration:   attempt.duration,
		Usage:      attempt.completion.Usage,
		CostUSD:    Cost(attempt.route.Price, attempt.completion.Usage),
		Created:    attempt.started,
	}
	if reason := attempt.completion.FinishReason; reason != "" {
		record.FinishReason = &reason
	}
	if first := attempt.completion.FirstToken; first > 0 {
		record.FirstToken = &first
	}
	if s.options.RecordPayloads {
		payload := attempt.payload
		if attempt.completion.Text != "" {
			output := attempt.completion.Text
			payload.Output = &output
		}
		record.Payload = &payload
	}
	id, err := s.requests.Record(ctx, record)
	if err != nil {
		return 0, fmt.Errorf("record ai request: %w", err)
	}
	return id, nil
}
