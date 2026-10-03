package analysispg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
)

const (
	publishedGame  = 1
	fileOnStorage  = 3
	fileTypeS3     = 1
	fileTypeLink   = 2
	fileTypeOthers = 3
)

type StatsStore struct {
	client *ent.Client
}

func NewStatsStore(client *ent.Client) *StatsStore {
	return &StatsStore{client: client}
}

func (s *StatsStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *StatsStore) Totals(ctx context.Context) (analysis.Totals, error) {
	rows, err := s.db(ctx).QueryContext(ctx, `
SELECT
  (SELECT COUNT(*) FROM games WHERE status = $1),
  (SELECT COUNT(*) FROM game_download_resource_files WHERE (file_status = $2 AND type = $3) OR type IN ($4, $5)),
  (SELECT COUNT(*) FROM game_download_resources r JOIN games g ON g.id = r.game_id WHERE g.status = $1),
  (SELECT COALESCE(SUM(file_size), 0)::bigint FROM game_download_resource_files WHERE file_status = $2 AND type = $3)`,
		publishedGame, fileOnStorage, fileTypeS3, fileTypeLink, fileTypeOthers)
	if err != nil {
		return analysis.Totals{}, fmt.Errorf("aggregate site totals: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var totals analysis.Totals
	if rows.Next() {
		if err := rows.Scan(&totals.Games, &totals.Files, &totals.Resources, &totals.StorageBytes); err != nil {
			return analysis.Totals{}, fmt.Errorf("scan site totals: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return analysis.Totals{}, fmt.Errorf("read site totals: %w", err)
	}
	return totals, nil
}

func (s *StatsStore) Games(ctx context.Context, ids []int) (map[int]analysis.GameRef, error) {
	refs := map[int]analysis.GameRef{}
	if len(ids) == 0 {
		return refs, nil
	}
	rows, err := s.db(ctx).Game.Query().
		Where(entgame.IDIn(ids...)).
		Select(entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load game titles: %w", err)
	}
	rated, err := s.db(ctx).Game.Query().
		Where(entgame.IDIn(ids...), entgame.Not(gamepg.SafeForStrictViewers())).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("load rated games: %w", err)
	}
	ratedSet := make(map[int]bool, len(rated))
	for _, id := range rated {
		ratedSet[id] = true
	}
	for _, row := range rows {
		refs[row.ID] = analysis.GameRef{
			Titles: analysis.GameTitles{JP: row.TitleJp, ZH: row.TitleZh, EN: row.TitleEn},
			Rated:  ratedSet[row.ID],
		}
	}
	return refs, nil
}

func (s *StatsStore) RatedFiles(ctx context.Context, fileIDs []int) (map[int]bool, error) {
	rated := map[int]bool{}
	if len(fileIDs) == 0 {
		return rated, nil
	}
	ids, err := s.db(ctx).GameDownloadResourceFile.Query().
		Where(
			gamedownloadresourcefile.IDIn(fileIDs...),
			gamedownloadresourcefile.HasGameDownloadResourceWith(
				gamedownloadresource.HasGameWith(entgame.Not(gamepg.SafeForStrictViewers())),
			),
		).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("load rated files: %w", err)
	}
	for _, id := range ids {
		rated[id] = true
	}
	return rated, nil
}
