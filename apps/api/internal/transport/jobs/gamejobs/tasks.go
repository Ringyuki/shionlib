package gamejobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

func HotScoreTask(service *game.HotScoreService, logger *slog.Logger) jobs.Task {
	return jobs.Task{
		Name:     "game.refresh_hot_score",
		Schedule: "0 * * * *",
		Timeout:  10 * time.Minute,
		Run: func(ctx context.Context) error {
			affected, err := service.Refresh(ctx)
			if err != nil {
				return err
			}
			logger.InfoContext(ctx, "hot scores refreshed", slog.Int64("affected", affected))
			return nil
		},
	}
}
