package indexingjobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

func PushTask(service *indexing.Service, logger *slog.Logger) jobs.Task {
	return jobs.Task{
		Name:     "indexing.push",
		Schedule: "*/10 * * * *",
		Timeout:  2 * time.Minute,
		Run: func(ctx context.Context) error {
			pushed, err := service.Push(ctx)
			if err != nil {
				return err
			}
			if pushed > 0 {
				logger.InfoContext(ctx, "addresses pushed to indexnow", slog.Int("count", pushed))
			}
			return nil
		},
	}
}
