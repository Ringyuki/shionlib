package ai

import (
	"context"
	"errors"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"
)

type ProbeService struct {
	gateway *Service
	repo    Repository
	queue   Queue
	now     func() time.Time
}

func NewProbeService(gateway *Service, repo Repository, queue Queue, now func() time.Time) *ProbeService {
	return &ProbeService{gateway: gateway, repo: repo, queue: queue, now: now}
}

func (s *ProbeService) Check(ctx context.Context, routeID int) (*Failure, error) {
	target, err := s.gateway.RouteTarget(ctx, routeID, SourceCheck)
	if err != nil {
		return nil, err
	}
	if target.Model.Moderation {
		_, err = s.gateway.RunModeration(ctx, target, ModerationRequest{Input: checkInput})
	} else {
		_, err = s.gateway.RunObject(ctx, target, ObjectRequest{Prompt: UserPrompt("", checkPrompt), Schema: checkSchema, SchemaName: checkSchemaName})
	}
	if failure, ok := upstreamFailure(err); ok {
		return failure, nil
	}
	if err != nil {
		return nil, err
	}
	recovered, err := s.repo.RecoverRoute(ctx, routeID, s.now())
	if err != nil || !recovered {
		return nil, err
	}
	return nil, s.queue.Enqueue(ctx, RouteStatusNotice{RouteID: routeID, Suspended: false})
}

func (s *ProbeService) ProbeSuspended(ctx context.Context) error {
	ids, err := s.repo.SuspendedRouteIDs(ctx)
	if err != nil {
		return err
	}
	var (
		mu   sync.Mutex
		errs []error
	)
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(probeConcurrency)
	for _, id := range ids {
		group.Go(func() error {
			if _, err := s.Check(groupCtx, id); err != nil {
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
			}
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return err
	}
	return errors.Join(errs...)
}

func upstreamFailure(err error) (*Failure, bool) {
	if err == nil || (!errors.Is(err, ErrUnavailable) && !errors.Is(err, ErrOutputMalformed)) {
		return nil, false
	}
	var failure *Failure
	if !errors.As(err, &failure) {
		failure = &Failure{Kind: ErrorOther, Message: err.Error()}
	}
	return failure, true
}
