package scan

import (
	"fmt"
	"sync"
	"time"
)

const (
	BackfillWorkerLimit     = 8
	backfillSettingRecheck  = 30 * time.Second
	backfillStopBeforeLimit = 15 * time.Minute
	backfillRetryDelay      = time.Hour
	backfillMissingDelay    = 24 * time.Hour
	backfillMissingNamed    = 10
)

type backfillRound struct {
	mu      sync.Mutex
	missing []int
	errs    []error
}

func (r *backfillRound) failed(err error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.errs = append(r.errs, err)
}

func (r *backfillRound) lacking(resourceID int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.missing = append(r.missing, resourceID)
}

func (r *backfillRound) result() []error {
	r.mu.Lock()
	defer r.mu.Unlock()
	errs := r.errs
	if len(r.missing) > 0 {
		named := r.missing[:min(len(r.missing), backfillMissingNamed)]
		errs = append(errs, fmt.Errorf("the bucket holds no object for files of %d resources, among them %v", len(r.missing), named))
	}
	return errs
}
