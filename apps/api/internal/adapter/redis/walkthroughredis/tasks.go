package walkthroughredis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type FormatTaskStore struct {
	client *redis.Client
}

func NewFormatTaskStore(client *redis.Client) *FormatTaskStore {
	return &FormatTaskStore{client: client}
}

func (s *FormatTaskStore) key(id string) string {
	return s.client.Key("walkthrough", "format", "task", id)
}

func (s *FormatTaskStore) Save(ctx context.Context, task walkthrough.FormatTask, ttl time.Duration) error {
	encoded, err := json.Marshal(toTaskRecord(task))
	if err != nil {
		return fmt.Errorf("encode format task %s: %w", task.ID, err)
	}
	if err := s.client.Set(ctx, s.key(task.ID), encoded, ttl).Err(); err != nil {
		return fmt.Errorf("save format task %s: %w", task.ID, err)
	}
	return nil
}

func (s *FormatTaskStore) Get(ctx context.Context, id string) (walkthrough.FormatTask, bool, error) {
	encoded, err := s.client.Get(ctx, s.key(id)).Bytes()
	if errors.Is(err, goredis.Nil) {
		return walkthrough.FormatTask{}, false, nil
	}
	if err != nil {
		return walkthrough.FormatTask{}, false, fmt.Errorf("load format task %s: %w", id, err)
	}
	var record taskRecord
	if err := json.Unmarshal(encoded, &record); err != nil {
		return walkthrough.FormatTask{}, false, fmt.Errorf("decode format task %s: %w", id, err)
	}
	return record.toTask(), true, nil
}
