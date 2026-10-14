package apikey

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type AccessService struct {
	repo     Repository
	usage    UsageStore
	counter  Counter
	settings setting.Source
	now      func() time.Time
}

func NewAccessService(deps Deps) *AccessService {
	return &AccessService{repo: deps.Repo, usage: deps.Usage, counter: deps.Counter, settings: deps.Settings, now: deps.Now}
}

func (s *AccessService) Authenticate(ctx context.Context, secret, ip string) (Holder, error) {
	if secret == "" {
		return Holder{}, ErrKeyRequired
	}
	if !Enabled.Read(s.settings) {
		return Holder{}, ErrClosed
	}
	if !strings.HasPrefix(secret, SecretPrefix) {
		return Holder{}, ErrKeyInvalid
	}
	key, err := s.repo.BySecretHash(ctx, hashOf(secret))
	if errors.Is(err, ErrNotFound) {
		return Holder{}, ErrKeyInvalid
	}
	if err != nil {
		return Holder{}, err
	}
	if key.Suspended() {
		return Holder{}, ErrKeySuspended
	}
	owner, err := s.repo.Owner(ctx, key.UserID)
	if err != nil {
		return Holder{}, err
	}
	if owner.Banned {
		return Holder{}, ErrOwnerBanned
	}
	now := s.now()
	if key.LastUsedAt == nil || now.Sub(*key.LastUsedAt) >= TouchInterval {
		if err := s.repo.Touch(ctx, key.ID, now, ip); err != nil {
			return Holder{}, err
		}
	}
	return Holder{KeyID: key.ID, UserID: key.UserID, Limit: owner.Limit}, nil
}

func (s *AccessService) Record(ctx context.Context, holder Holder, throttled bool) error {
	return s.counter.Count(ctx, holder.KeyID, DayOf(s.now()), throttled)
}

func (s *AccessService) Flush(ctx context.Context) error {
	today := DayOf(s.now())
	for _, day := range daysUpTo(today, FlushDays) {
		counts, err := s.counter.Counts(ctx, day)
		if err != nil {
			return err
		}
		if err := s.usage.SaveCounts(ctx, counts); err != nil {
			return err
		}
	}
	return s.usage.PruneBefore(ctx, DayOf(s.now().Add(-UsageRetention)))
}
