package redis

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/redis/go-redis/extra/redisotel/v9"
	goredis "github.com/redis/go-redis/v9"
)

type Options struct {
	Host      string
	Port      int
	Password  string
	DB        int
	KeyPrefix string
	Timeout   time.Duration
}

type Client struct {
	*goredis.Client
	prefix string
}

func Open(ctx context.Context, opts Options) (*Client, error) {
	client := goredis.NewClient(&goredis.Options{
		Addr:         net.JoinHostPort(opts.Host, strconv.Itoa(opts.Port)),
		Password:     opts.Password,
		DB:           opts.DB,
		DialTimeout:  opts.Timeout,
		ReadTimeout:  opts.Timeout,
		WriteTimeout: opts.Timeout,
	})
	if err := redisotel.InstrumentTracing(client); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("instrument redis: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return &Client{Client: client, prefix: opts.KeyPrefix}, nil
}

func (c *Client) Key(parts ...string) string {
	key := c.prefix
	for _, part := range parts {
		if key == "" {
			key = part
			continue
		}
		key += ":" + part
	}
	return key
}

func (c *Client) Shutdown(context.Context) error {
	return c.Close()
}
