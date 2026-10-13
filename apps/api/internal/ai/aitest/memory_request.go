package aitest

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type storedRequest struct {
	request ai.Request
	detail  ai.RequestDetail
	payload *ai.Payload
	created time.Time
}

type MemoryRequestLog struct {
	mu       sync.Mutex
	repo     *MemoryRepository
	nextID   int64
	requests []*storedRequest
}

func NewMemoryRequestLog(repo *MemoryRepository) *MemoryRequestLog {
	return &MemoryRequestLog{repo: repo}
}

func (l *MemoryRequestLog) Records() []ai.Request {
	l.mu.Lock()
	defer l.mu.Unlock()
	requests := make([]ai.Request, len(l.requests))
	for i, stored := range l.requests {
		requests[i] = stored.request
	}
	return requests
}

func (l *MemoryRequestLog) Record(_ context.Context, record ai.RequestRecord) (int64, error) {
	model, provider := l.repo.refs(record.ModelID, record.ProviderID)
	l.mu.Lock()
	defer l.mu.Unlock()
	l.nextID++
	created := record.Created
	if created.IsZero() {
		created = time.Now()
	}
	created = created.UTC()
	request := ai.Request{
		ID:         l.nextID,
		CallID:     record.CallID,
		Source:     record.Source,
		Scene:      record.Scene,
		Model:      model,
		RouteID:    record.RouteID,
		Provider:   provider,
		UpstreamID: record.UpstreamID,
		Protocol:   record.Protocol,
		OK:         record.OK,
		Adaptation: record.Adaptation,
		DurationMS: int(record.Duration.Milliseconds()),
		Usage:      record.Usage,
		CostUSD:    record.CostUSD,
		Created:    created,
	}
	detail := ai.RequestDetail{}
	if failure := record.Failure; failure != nil {
		kind, message, detailText := failure.Kind, clip(failure.Message, 500), failure.Detail
		request.ErrorKind, request.ErrorMessage, detail.ErrorDetail = &kind, &message, &detailText
	}
	if record.FinishReason != nil {
		reason := string(*record.FinishReason)
		detail.FinishReason = &reason
	}
	if record.FirstToken != nil {
		ms := int(record.FirstToken.Milliseconds())
		request.FirstTokenMS = &ms
	}
	var payload *ai.Payload
	if record.Payload != nil {
		copied := *record.Payload
		copied.Messages = slices.Clone(copied.Messages)
		copied.Schema = slices.Clone(copied.Schema)
		payload = &copied
	}
	l.requests = append(l.requests, &storedRequest{request: request, detail: detail, payload: payload, created: created})
	return l.nextID, nil
}

func matches(request ai.Request, filter ai.RequestFilter) bool {
	return !request.Created.Before(filter.Since.UTC()) &&
		(filter.Scene == nil || (request.Scene != nil && *request.Scene == *filter.Scene)) &&
		(filter.ModelID == nil || (request.Model != nil && request.Model.ID == *filter.ModelID)) &&
		(filter.ProviderID == nil || (request.Provider != nil && request.Provider.ID == *filter.ProviderID)) &&
		(filter.RouteID == nil || (request.RouteID != nil && *request.RouteID == *filter.RouteID)) &&
		(filter.Source == nil || request.Source == *filter.Source) &&
		(filter.OK == nil || request.OK == *filter.OK) &&
		(filter.ErrorKind == nil || (request.ErrorKind != nil && *request.ErrorKind == *filter.ErrorKind))
}

func (l *MemoryRequestLog) ListRequests(_ context.Context, filter ai.RequestFilter, page ai.Page) ([]ai.Request, int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	matched := []ai.Request{}
	for i := len(l.requests) - 1; i >= 0; i-- {
		if matches(l.requests[i].request, filter) {
			matched = append(matched, l.requests[i].request)
		}
	}
	total := len(matched)
	start := min(page.Offset(), total)
	end := min(start+page.Size, total)
	return matched[start:end], total, nil
}

func (l *MemoryRequestLog) GetRequest(_ context.Context, id int64) (ai.RequestDetail, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, stored := range l.requests {
		if stored.request.ID == id {
			detail := stored.detail
			detail.Request = stored.request
			detail.Payload = stored.payload
			return detail, nil
		}
	}
	return ai.RequestDetail{}, ai.ErrRequestNotFound
}

func (l *MemoryRequestLog) Attempts(_ context.Context, callID string) ([]ai.Request, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	attempts := []ai.Request{}
	for _, stored := range l.requests {
		if stored.request.CallID == callID {
			attempts = append(attempts, stored.request)
		}
	}
	return attempts, nil
}

func (l *MemoryRequestLog) PurgeRequests(_ context.Context, before time.Time) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	kept := l.requests[:0]
	removed := 0
	for _, stored := range l.requests {
		if stored.created.Before(before.UTC()) {
			removed++
			continue
		}
		kept = append(kept, stored)
	}
	l.requests = kept
	return removed, nil
}

func (l *MemoryRequestLog) PurgePayloads(_ context.Context, before time.Time) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	removed := 0
	for _, stored := range l.requests {
		if stored.payload != nil && stored.created.Before(before.UTC()) {
			stored.payload = nil
			removed++
		}
	}
	return removed, nil
}
