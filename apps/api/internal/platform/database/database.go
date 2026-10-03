package database

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

type Options struct {
	URL              string
	MaxConns         int
	MinConns         int
	ConnMaxLifetime  time.Duration
	ConnMaxIdleTime  time.Duration
	StatementTimeout time.Duration
	ApplicationName  string
}

type DB struct {
	Pool *pgxpool.Pool
	SQL  *sql.DB
}

func Open(ctx context.Context, opts Options) (*DB, error) {
	config, err := pgxpool.ParseConfig(opts.URL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	config.MaxConns = int32(opts.MaxConns)
	config.MinConns = int32(opts.MinConns)
	config.MaxConnLifetime = opts.ConnMaxLifetime
	config.MaxConnIdleTime = opts.ConnMaxIdleTime
	config.ConnConfig.Tracer = otelpgx.NewTracer()
	runtime := config.ConnConfig.RuntimeParams
	runtime["timezone"] = "UTC"
	if opts.ApplicationName != "" {
		runtime["application_name"] = opts.ApplicationName
	}
	if opts.StatementTimeout > 0 {
		runtime["statement_timeout"] = strconv.FormatInt(opts.StatementTimeout.Milliseconds(), 10)
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("open database pool: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &DB{Pool: pool, SQL: stdlib.OpenDBFromPool(pool)}, nil
}

func (db *DB) Ping(ctx context.Context) error {
	return db.Pool.Ping(ctx)
}

func (db *DB) Close(context.Context) error {
	err := db.SQL.Close()
	db.Pool.Close()
	return err
}
