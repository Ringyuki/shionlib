package uploadredis

import (
	"context"
	"fmt"
	"strconv"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

var hold = goredis.NewScript(`
local holder = redis.call('GET', KEYS[1])
if holder and holder ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return 1
`)

type Holds struct {
	client *redis.Client
}

func NewHolds(client *redis.Client) *Holds {
	return &Holds{client: client}
}

func (h *Holds) Hold(ctx context.Context, sessionID int, holder string, ttl time.Duration) (bool, error) {
	held, err := hold.Run(ctx, h.client.Client, []string{h.key(sessionID)}, holder, ttl.Milliseconds()).Int()
	if err != nil {
		return false, fmt.Errorf("hold upload session %d: %w", sessionID, err)
	}
	return held == 1, nil
}

func (h *Holds) Holders(ctx context.Context, sessionIDs []int) (map[int]string, error) {
	holders := map[int]string{}
	if len(sessionIDs) == 0 {
		return holders, nil
	}
	keys := make([]string, len(sessionIDs))
	for i, id := range sessionIDs {
		keys[i] = h.key(id)
	}
	values, err := h.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("read holders of upload sessions: %w", err)
	}
	for i, value := range values {
		if holder, ok := value.(string); ok && holder != "" {
			holders[sessionIDs[i]] = holder
		}
	}
	return holders, nil
}

func (h *Holds) key(sessionID int) string {
	return h.client.Key("upload", "hold", strconv.Itoa(sessionID))
}
