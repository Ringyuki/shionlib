package bootstrap

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/database"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/logger"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type Infra struct {
	Config  *config.Config
	Logger  *slog.Logger
	DB      *database.DB
	SQL     *sql.DB
	Ent     *ent.Client
	Redis   *redis.Client
	Catalog *i18n.Catalog
	Queue   *queue.Queue
	Now     func() time.Time
}

func Now() time.Time {
	return time.Now().UTC()
}

func NewLogger(cfg *config.Config) *slog.Logger {
	return logger.New(os.Stdout, logger.Options{
		Level:   logger.ParseLevel(cfg.Log.Level),
		Format:  logger.Format(cfg.Log.Format),
		Service: cfg.App.Name,
		Version: cfg.App.Version,
	})
}

func OpenInfra(ctx context.Context, cfg *config.Config, log *slog.Logger) (*Infra, error) {
	catalog, err := i18n.Load(i18n.Locale(cfg.App.DefaultLocale))
	if err != nil {
		return nil, err
	}
	db, err := database.Open(ctx, database.Options{
		URL:              cfg.Database.URL,
		MaxConns:         cfg.Database.MaxConns,
		MinConns:         cfg.Database.MinConns,
		ConnMaxLifetime:  cfg.Database.ConnMaxLifetime,
		ConnMaxIdleTime:  cfg.Database.ConnMaxIdleTime,
		StatementTimeout: cfg.Database.StatementTimeout,
		ApplicationName:  cfg.App.Name,
	})
	if err != nil {
		return nil, err
	}
	cache, err := redis.Open(ctx, redis.Options{
		Host:      cfg.Redis.Host,
		Port:      cfg.Redis.Port,
		Password:  cfg.Redis.Password,
		DB:        cfg.Redis.DB,
		KeyPrefix: cfg.Redis.KeyPrefix,
		Timeout:   cfg.Redis.Timeout,
	})
	if err != nil {
		return nil, errors.Join(err, db.Close(ctx))
	}
	inserter, err := jobs.NewInserter(db.Pool, log)
	if err != nil {
		return nil, errors.Join(err, cache.Shutdown(ctx), db.Close(ctx))
	}
	return &Infra{
		Config:  cfg,
		Logger:  log,
		DB:      db,
		SQL:     db.SQL,
		Ent:     postgres.NewClient(db.SQL),
		Redis:   cache,
		Catalog: catalog,
		Queue:   queue.New(inserter),
		Now:     Now,
	}, nil
}

func OfflineInfra(cfg *config.Config, log *slog.Logger) (*Infra, error) {
	catalog, err := i18n.Load(i18n.Locale(cfg.App.DefaultLocale))
	if err != nil {
		return nil, err
	}
	sqlDB, err := sql.Open("pgx", cfg.Database.URL)
	if err != nil {
		return nil, fmt.Errorf("open offline database handle: %w", err)
	}
	return &Infra{
		Config:  cfg,
		Logger:  log,
		SQL:     sqlDB,
		Ent:     postgres.NewClient(sqlDB),
		Redis:   &redis.Client{Client: goredis.NewClient(&goredis.Options{Addr: "127.0.0.1:0"})},
		Catalog: catalog,
		Now:     Now,
	}, nil
}

func (i *Infra) Close(ctx context.Context) error {
	var errs []error
	if i.Redis != nil {
		errs = append(errs, i.Redis.Shutdown(ctx))
	}
	if i.DB != nil {
		errs = append(errs, i.DB.Close(ctx))
	} else if i.SQL != nil {
		errs = append(errs, i.SQL.Close())
	}
	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("close infrastructure: %w", err)
	}
	return nil
}
