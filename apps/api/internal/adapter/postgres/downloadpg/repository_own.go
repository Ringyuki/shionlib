package downloadpg

import (
	"context"
	"fmt"
	"time"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func (r *Repository) ListOwnResources(ctx context.Context, creatorID int, query download.OwnQuery, page download.Page) ([]download.GameResource, int, error) {
	predicates := ownResources(creatorID)
	switch query.Scope {
	case download.OwnProcessing:
		predicates = append(predicates, processingResource())
	case download.OwnPublished:
		predicates = append(predicates, gamedownloadresource.Not(processingResource()))
	}
	if query.Search != "" {
		predicates = append(predicates, namedLike(query.Search))
	}
	field := gamedownloadresource.FieldUpdated
	if query.Sort == download.OwnSortDownloads {
		field = gamedownloadresource.FieldDownloads
	}
	direction := ent.Desc
	if query.Ascending {
		direction = ent.Asc
	}
	found := r.db(ctx).GameDownloadResource.Query().Where(predicates...)
	total, err := found.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count resources of user %d: %w", creatorID, err)
	}
	rows, err := withFileDetails(found.
		Order(direction(field), direction(gamedownloadresource.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size)).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list resources of user %d: %w", creatorID, err)
	}
	resources, err := r.gameResources(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	return resources, total, nil
}

func (r *Repository) SummarizeOwnResources(ctx context.Context, creatorID int, recentSince time.Time) (download.OwnSummary, error) {
	var totals []struct {
		Count     int `json:"count"`
		Downloads int `json:"downloads"`
		Games     int `json:"games"`
	}
	err := r.db(ctx).GameDownloadResource.Query().
		Where(ownResources(creatorID)...).
		Aggregate(
			ent.Count(),
			ent.As(func(s *sql.Selector) string {
				return "COALESCE(SUM(" + s.C(gamedownloadresource.FieldDownloads) + "), 0)"
			}, "downloads"),
			ent.As(func(s *sql.Selector) string {
				return "COUNT(DISTINCT " + s.C(gamedownloadresource.FieldGameID) + ")"
			}, "games"),
		).
		Scan(ctx, &totals)
	if err != nil {
		return download.OwnSummary{}, fmt.Errorf("total resources of user %d: %w", creatorID, err)
	}
	processing, err := r.db(ctx).GameDownloadResource.Query().
		Where(append(ownResources(creatorID), processingResource())...).
		Count(ctx)
	if err != nil {
		return download.OwnSummary{}, fmt.Errorf("count processing resources of user %d: %w", creatorID, err)
	}
	recent, err := r.db(ctx).GameDownloadResource.Query().
		Where(append(ownResources(creatorID), gamedownloadresource.CreatedGTE(recentSince))...).
		Count(ctx)
	if err != nil {
		return download.OwnSummary{}, fmt.Errorf("count recent resources of user %d: %w", creatorID, err)
	}
	files, err := r.db(ctx).GameDownloadResourceFile.Query().
		Where(gamedownloadresourcefile.HasGameDownloadResourceWith(ownResources(creatorID)...)).
		Count(ctx)
	if err != nil {
		return download.OwnSummary{}, fmt.Errorf("count files of user %d: %w", creatorID, err)
	}
	summary := download.OwnSummary{Processing: processing, Recent: recent, Files: files}
	if len(totals) > 0 {
		summary.Published = totals[0].Count - processing
		summary.Downloads = totals[0].Downloads
		summary.Games = totals[0].Games
	}
	return summary, nil
}

func ownResources(creatorID int) []predicate.GameDownloadResource {
	return []predicate.GameDownloadResource{gamepg.ActiveResource(), gamedownloadresource.CreatorID(creatorID)}
}

func processingResource() predicate.GameDownloadResource {
	return gamedownloadresource.Or(gamedownloadresource.PublishedAtIsNil(), gamedownloadresource.HasFilesWith(unsettledFile()))
}

func unsettledFile() predicate.GameDownloadResourceFile {
	return gamedownloadresourcefile.And(
		gamedownloadresourcefile.Type(download.FileTypeObjectStore),
		gamedownloadresourcefile.Or(gamedownloadresourcefile.FileStatusNEQ(download.FileInObjectStore), gamepg.UnderReviewFile()),
	)
}

func namedLike(search string) predicate.GameDownloadResource {
	return gamedownloadresource.Or(
		gamedownloadresource.HasGameWith(entgame.Or(
			entgame.TitleZhContainsFold(search),
			entgame.TitleJpContainsFold(search),
			entgame.TitleEnContainsFold(search),
			func(s *sql.Selector) { s.Where(gamepg.AnyElementContainsFold(s.C(entgame.FieldAliases), search)) },
		)),
		gamedownloadresource.HasFilesWith(gamedownloadresourcefile.FileNameContainsFold(search)),
	)
}
