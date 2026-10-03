package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/bootstrap"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/database"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/runtime"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/server"
)

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "shionlib-api:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	command := "serve"
	if len(args) > 0 {
		command = args[0]
	}
	switch command {
	case "serve":
		return serve(ctx, true)
	case "worker":
		return serve(ctx, false)
	case "migrate":
		sub := "up"
		if len(args) > 1 {
			sub = args[1]
		}
		return migrate(ctx, sub)
	case "openapi":
		return openapi(args[1:])
	default:
		return fmt.Errorf("unknown command %q (expected serve, worker, migrate up|status, openapi)", command)
	}
}

func serve(ctx context.Context, withHTTP bool) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger := bootstrap.NewLogger(cfg)
	infra, err := bootstrap.OpenInfra(ctx, cfg, logger)
	if err != nil {
		return err
	}
	app := runtime.NewApp(logger, cfg.App.ShutdownTimeout)
	app.Close("infrastructure", infra.Close)
	modules := bootstrap.BuildModules(infra)
	runner, err := bootstrap.BuildJobs(infra, !withHTTP || cfg.Tasks.WorkersEnabled, modules.Jobs)
	if err != nil {
		return errors.Join(err, infra.Close(ctx))
	}
	app.Run("jobs", runner)
	if !withHTTP {
		return app.Start(ctx)
	}
	api := bootstrap.BuildHTTP(infra, modules)
	app.Run("http", server.NewHTTP(api.Handler(), server.HTTPOptions{
		Addr:              ":" + strconv.Itoa(cfg.HTTP.Port),
		ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       cfg.HTTP.IdleTimeout,
		ShutdownTimeout:   cfg.App.ShutdownTimeout,
	}, logger))
	return app.Start(ctx)
}

func migrate(ctx context.Context, sub string) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger := bootstrap.NewLogger(cfg)
	db, err := database.Open(ctx, database.Options{URL: cfg.Database.URL, MaxConns: 2, MinConns: 0, ApplicationName: cfg.App.Name + "-migrate"})
	if err != nil {
		return err
	}
	defer func() {
		_ = db.Close(ctx)
	}()
	migrator := database.NewMigrator(db.SQL, logger)
	switch sub {
	case "up":
		if err := migrator.Up(ctx); err != nil {
			return err
		}
		return jobs.Migrate(ctx, db.Pool)
	case "status":
		version, dirty, err := migrator.Status()
		if err != nil {
			return err
		}
		_, err = fmt.Fprintf(os.Stdout, "version=%d dirty=%t\n", version, dirty)
		return err
	default:
		return fmt.Errorf("unknown migrate command %q", sub)
	}
}

func openapi(args []string) error {
	cfg, err := config.LoadFrom(map[string]string{
		"DATABASE_URL":         "postgres://offline@localhost:5432/offline",
		"TOKEN_SECRET":         "offline-openapi-secret",
		"REFRESH_TOKEN_PEPPER": "offline",
	})
	if err != nil {
		return err
	}
	infra, err := bootstrap.OfflineInfra(cfg, bootstrap.NewLogger(cfg))
	if err != nil {
		return err
	}
	defer func() {
		_ = infra.Close(context.Background())
	}()
	spec := bootstrap.BuildHTTP(infra, bootstrap.BuildModules(infra)).OpenAPI()
	encoded, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}
	if len(args) == 0 {
		_, err = os.Stdout.Write(append(encoded, '\n'))
		return err
	}
	if args[0] == "" {
		return errors.New("openapi output path is empty")
	}
	return os.WriteFile(filepath.Clean(args[0]), append(encoded, '\n'), 0o600)
}
