package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

const subscriptionBuffer = 32

type Event struct {
	Name string          `json:"event"`
	Data json.RawMessage `json:"data"`
}

type Subscription struct {
	hub    *Hub
	userID int
	events chan Event
	once   sync.Once
}

func (s *Subscription) Events() <-chan Event {
	return s.events
}

func (s *Subscription) Close() {
	s.once.Do(func() {
		s.hub.remove(s)
	})
}

type Hub struct {
	client *redis.Client
	logger *slog.Logger
	prefix string
	mu     sync.RWMutex
	subs   map[int]map[*Subscription]struct{}
}

func NewHub(client *redis.Client, logger *slog.Logger) *Hub {
	return &Hub{
		client: client,
		logger: logger,
		prefix: client.Key("realtime", "user") + ":",
		subs:   map[int]map[*Subscription]struct{}{},
	}
}

func (h *Hub) Publish(ctx context.Context, userID int, name string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode realtime event %s: %w", name, err)
	}
	raw, err := json.Marshal(Event{Name: name, Data: data})
	if err != nil {
		return fmt.Errorf("encode realtime envelope %s: %w", name, err)
	}
	if err := h.client.Publish(ctx, h.prefix+strconv.Itoa(userID), raw).Err(); err != nil {
		return fmt.Errorf("publish realtime event %s: %w", name, err)
	}
	return nil
}

func (h *Hub) Subscribe(userID int) *Subscription {
	sub := &Subscription{hub: h, userID: userID, events: make(chan Event, subscriptionBuffer)}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.subs[userID] == nil {
		h.subs[userID] = map[*Subscription]struct{}{}
	}
	h.subs[userID][sub] = struct{}{}
	return sub
}

func (h *Hub) Run(ctx context.Context) error {
	pubsub := h.client.PSubscribe(ctx, h.prefix+"*")
	defer func() {
		_ = pubsub.Close()
	}()
	if _, err := pubsub.Receive(ctx); err != nil {
		return fmt.Errorf("subscribe to realtime events: %w", err)
	}
	channel := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return nil
		case message, ok := <-channel:
			if !ok {
				return nil
			}
			userID, err := strconv.Atoi(strings.TrimPrefix(message.Channel, h.prefix))
			if err != nil {
				continue
			}
			var event Event
			if err := json.Unmarshal([]byte(message.Payload), &event); err != nil {
				h.logger.WarnContext(ctx, "discarding malformed realtime event", slog.Any("error", err))
				continue
			}
			h.dispatch(userID, event)
		}
	}
}

func (h *Hub) dispatch(userID int, event Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for sub := range h.subs[userID] {
		select {
		case sub.events <- event:
		default:
		}
	}
}

func (h *Hub) remove(sub *Subscription) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subs[sub.userID], sub)
	if len(h.subs[sub.userID]) == 0 {
		delete(h.subs, sub.userID)
	}
	close(sub.events)
}
