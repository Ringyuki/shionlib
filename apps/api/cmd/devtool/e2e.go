package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/argon2hash"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/keybox"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/database"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

func runE2E(ctx context.Context, command string) (err error) {
	if command != "reset" && command != "seed" && command != "prepare" {
		return fmt.Errorf("usage: devtool e2e <reset | seed | prepare>")
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	db, err := database.Open(ctx, database.Options{URL: cfg.Database.URL, MaxConns: 4, ApplicationName: cfg.App.Name + "-e2e-seed"})
	if err != nil {
		return err
	}
	defer func() {
		err = errors.Join(err, db.Close(ctx))
	}()
	cache, err := redis.Open(ctx, redis.Options{
		Host:      cfg.Redis.Host,
		Port:      cfg.Redis.Port,
		Password:  cfg.Redis.Password,
		DB:        cfg.Redis.DB,
		KeyPrefix: cfg.Redis.KeyPrefix,
		Timeout:   cfg.Redis.Timeout,
	})
	if err != nil {
		return err
	}
	defer func() {
		err = errors.Join(err, cache.Shutdown(ctx))
	}()
	password := os.Getenv("E2E_USER_PASSWORD")
	if password == "" {
		password = e2eDefaultPassword
	}
	keys, err := keybox.NewBox(cfg.AI.KeySecret)
	if err != nil {
		return err
	}
	seeder := newE2ESeeder(e2eSeederDeps{
		SQL:      db.SQL,
		Redis:    cache,
		Keys:     keys,
		Hasher:   argon2hash.New(argon2hash.PasswordParams()),
		Password: password,
		Now:      func() time.Time { return time.Now().UTC() },
		Out:      os.Stdout,
	})
	switch command {
	case "reset":
		return seeder.Reset(ctx)
	case "seed":
		_, err = seeder.Seed(ctx)
		return err
	default:
		_, err = seeder.Prepare(ctx)
		return err
	}
}
