package uploadtest

import (
	"context"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type MemoryQuotaRepository struct {
	mu        sync.Mutex
	standings map[int]upload.Standing
	stored    map[int]int64
	inFlight  map[int]int64
}

func NewMemoryQuotaRepository() *MemoryQuotaRepository {
	return &MemoryQuotaRepository{standings: map[int]upload.Standing{}, stored: map[int]int64{}, inFlight: map[int]int64{}}
}

func (r *MemoryQuotaRepository) SeedStanding(userID int, standing upload.Standing) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.standings[userID] = standing
}

func (r *MemoryQuotaRepository) SeedUsage(userID int, stored, inFlight int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stored[userID], r.inFlight[userID] = stored, inFlight
}

func (r *MemoryQuotaRepository) Standing(_ context.Context, userID int) (upload.Standing, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.standings[userID], nil
}

func (r *MemoryQuotaRepository) StoredBytes(_ context.Context, userID int) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.stored[userID], nil
}

func (r *MemoryQuotaRepository) InFlightBytes(_ context.Context, userID int, _ time.Time) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.inFlight[userID], nil
}

func (r *MemoryQuotaRepository) SetTrusted(_ context.Context, userID int, trusted bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	standing := r.standings[userID]
	standing.Trusted = trusted
	r.standings[userID] = standing
	return nil
}
