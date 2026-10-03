package aipg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/airequest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/airequestpayload"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type RequestStore struct {
	client *ent.Client
	tx     *postgres.Transactor
}

func NewRequestStore(client *ent.Client) *RequestStore {
	return &RequestStore{client: client, tx: postgres.NewTransactor(client)}
}

func (s *RequestStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *RequestStore) Record(ctx context.Context, record ai.RequestRecord) (int64, error) {
	var id int64
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		created := record.Created
		if created.IsZero() {
			created = time.Now()
		}
		create := s.db(ctx).AIRequest.Create().
			SetCallID(record.CallID).
			SetSource(string(record.Source)).
			SetNillableScene(record.Scene).
			SetNillableModelID(record.ModelID).
			SetNillableRouteID(record.RouteID).
			SetNillableProviderID(record.ProviderID).
			SetUpstreamID(record.UpstreamID).
			SetProtocol(string(record.Protocol)).
			SetOk(record.OK).
			SetNillableAdaptation(record.Adaptation).
			SetDurationMs(int(record.Duration.Milliseconds())).
			SetInputTokens(record.Usage.InputTokens).
			SetOutputTokens(record.Usage.OutputTokens).
			SetCacheReadTokens(record.Usage.CacheReadTokens).
			SetCacheWriteTokens(record.Usage.CacheWriteTokens).
			SetReasoningTokens(record.Usage.ReasoningTokens).
			SetCostUsd(record.CostUSD).
			SetCreated(created.UTC())
		if failure := record.Failure; failure != nil {
			create.SetErrorKind(string(failure.Kind)).
				SetErrorMessage(clip(failure.Message, maxErrorMessage)).
				SetErrorDetail(failure.Detail)
		}
		if record.FinishReason != nil {
			create.SetFinishReason(string(*record.FinishReason))
		}
		if record.FirstToken != nil {
			create.SetFirstTokenMs(int(record.FirstToken.Milliseconds()))
		}
		row, err := create.Save(ctx)
		if err != nil {
			return fmt.Errorf("record ai request: %w", err)
		}
		id = row.ID
		if record.Payload == nil {
			return nil
		}
		input, err := encodePayload(*record.Payload)
		if err != nil {
			return err
		}
		if err := s.db(ctx).AIRequestPayload.Create().
			SetRequestID(row.ID).
			SetInput(input).
			SetNillableOutput(record.Payload.Output).
			SetCreated(created.UTC()).
			Exec(ctx); err != nil {
			return fmt.Errorf("record ai request payload: %w", err)
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (s *RequestStore) ListRequests(ctx context.Context, filter ai.RequestFilter, page ai.Page) ([]ai.Request, int, error) {
	query := s.db(ctx).AIRequest.Query().Where(requestPredicates(filter)...)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count ai requests: %w", err)
	}
	rows, err := query.WithModel().WithProvider().
		Order(ent.Desc(airequest.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list ai requests: %w", err)
	}
	requests := make([]ai.Request, len(rows))
	for i, row := range rows {
		requests[i] = toRequest(row)
	}
	return requests, total, nil
}

func requestPredicates(filter ai.RequestFilter) []predicate.AIRequest {
	predicates := []predicate.AIRequest{airequest.CreatedGTE(filter.Since.UTC())}
	if filter.Scene != nil {
		predicates = append(predicates, airequest.Scene(*filter.Scene))
	}
	if filter.ModelID != nil {
		predicates = append(predicates, airequest.ModelID(*filter.ModelID))
	}
	if filter.ProviderID != nil {
		predicates = append(predicates, airequest.ProviderID(*filter.ProviderID))
	}
	if filter.RouteID != nil {
		predicates = append(predicates, airequest.RouteID(*filter.RouteID))
	}
	if filter.Source != nil {
		predicates = append(predicates, airequest.Source(string(*filter.Source)))
	}
	if filter.OK != nil {
		predicates = append(predicates, airequest.Ok(*filter.OK))
	}
	if filter.ErrorKind != nil {
		predicates = append(predicates, airequest.ErrorKind(string(*filter.ErrorKind)))
	}
	return predicates
}

func (s *RequestStore) GetRequest(ctx context.Context, id int64) (ai.RequestDetail, error) {
	row, err := s.db(ctx).AIRequest.Query().
		Where(airequest.ID(id)).
		WithModel().
		WithProvider().
		WithPayload().
		Only(ctx)
	if postgres.IsNotFound(err) {
		return ai.RequestDetail{}, ai.ErrRequestNotFound
	}
	if err != nil {
		return ai.RequestDetail{}, fmt.Errorf("get ai request %d: %w", id, err)
	}
	return ai.RequestDetail{
		Request:      toRequest(row),
		ErrorDetail:  row.ErrorDetail,
		FinishReason: row.FinishReason,
		Payload:      decodePayload(row.Edges.Payload),
	}, nil
}

func (s *RequestStore) Attempts(ctx context.Context, callID string) ([]ai.Request, error) {
	rows, err := s.db(ctx).AIRequest.Query().
		Where(airequest.CallID(callID)).
		WithModel().
		WithProvider().
		Order(ent.Asc(airequest.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list ai request attempts: %w", err)
	}
	requests := make([]ai.Request, len(rows))
	for i, row := range rows {
		requests[i] = toRequest(row)
	}
	return requests, nil
}

func (s *RequestStore) PurgeRequests(ctx context.Context, before time.Time) (int, error) {
	count, err := s.db(ctx).AIRequest.Delete().Where(airequest.CreatedLT(before.UTC())).Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("purge ai requests: %w", err)
	}
	return count, nil
}

func (s *RequestStore) PurgePayloads(ctx context.Context, before time.Time) (int, error) {
	count, err := s.db(ctx).AIRequestPayload.Delete().Where(airequestpayload.CreatedLT(before.UTC())).Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("purge ai request payloads: %w", err)
	}
	return count, nil
}
