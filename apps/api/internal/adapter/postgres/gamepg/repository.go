package gamepg

import (
	"context"
	"fmt"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameimage"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamelink"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamerelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/tag"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const refreshHotScoreSQL = `
WITH base AS (
  SELECT
    g.id,
    GREATEST(1.0, EXTRACT(EPOCH FROM (NOW() - g.created)) / 86400.0) AS age_days,
    GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - COALESCE(g.release_date, g.created))) / 86400.0) AS release_age_days,
    g.views,
    g.downloads
  FROM "games" g
  WHERE g.status = 1
    AND COALESCE(g.release_date, g.created) <= NOW()
),
scores AS (
  SELECT
    b.id,
    (
      $1::float8 * LN(b.views + 1) +
      $2::float8 * LN(b.downloads + 1) +
      $3::float8 * LN(($4::float8 * b.views) / b.age_days + 1) +
      $5::float8 * LN(($4::float8 * b.downloads) / b.age_days + 1) +
      $6::float8 * EXP(- b.release_age_days / $7::float8) +
      $8::float8 * EXP(- b.age_days / $9::float8)
    ) AS new_score
  FROM base b
)
UPDATE "games" AS g
SET "hot_score" = s.new_score
FROM scores s
WHERE g.id = s.id
  AND g."hot_score" IS DISTINCT FROM s.new_score`

func (r *Repository) RefreshHotScore(ctx context.Context, w game.HotScoreWeights) (int64, error) {
	result, err := r.db(ctx).ExecContext(ctx, refreshHotScoreSQL,
		w.Views, w.Downloads, w.RecentViews, w.RecentWindowDays, w.RecentDownloads,
		w.Release, w.HalfLifeReleaseDays, w.Created, w.HalfLifeCreatedDays,
	)
	if err != nil {
		return 0, fmt.Errorf("refresh hot scores: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("count refreshed hot scores: %w", err)
	}
	return affected, nil
}

func overlaps(column string, values []string) *sql.Predicate {
	return sql.P(func(b *sql.Builder) {
		b.WriteString(column).WriteString(" && ").Arg(pgvalue.Strings(values)).WriteString("::text[]")
	})
}

func releasedIn(column string, periods []string) *sql.Predicate {
	return sql.P(func(b *sql.Builder) {
		b.WriteString("(to_char(").WriteString(column).WriteString(", 'YYYY-MM') = ANY(").Arg(pgvalue.Strings(periods)).WriteString("::text[])")
		b.WriteString(" OR to_char(").WriteString(column).WriteString(", 'YYYY') = ANY(").Arg(pgvalue.Strings(periods)).WriteString("::text[]))")
	})
}

func gameWhere(build func(s *sql.Selector) *sql.Predicate) predicate.Game {
	return predicate.Game(func(s *sql.Selector) {
		s.Where(build(s))
	})
}

const visibleStatus = 1

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func ListablePredicates(visibility game.Visibility) []predicate.Game {
	predicates := []predicate.Game{entgame.Status(visibleStatus)}
	if visibility.ExcludeRated {
		predicates = append(predicates, SafeForStrictViewers())
	}
	if visibility.OnlyWithResources {
		predicates = append(predicates, entgame.HasDownloadResourcesWith(gamedownloadresource.Status(visibleStatus)))
	}
	return predicates
}

func filterPredicates(filter game.ListFilter) []predicate.Game {
	predicates := ListablePredicates(filter.Visibility)
	if filter.DeveloperID != nil {
		predicates = append(predicates, entgame.HasDevelopersWith(gamedeveloperrelation.DeveloperID(*filter.DeveloperID)))
	}
	if filter.CharacterID != nil {
		predicates = append(predicates, entgame.HasCharactersWith(gamecharacterrelation.CharacterID(*filter.CharacterID)))
	}
	if len(filter.Tags) > 0 {
		predicates = append(predicates, entgame.HasTagsWith(tagNamed(filter.Tags)))
	}
	if len(filter.ExcludeTags) > 0 {
		predicates = append(predicates, entgame.Not(entgame.HasTagsWith(tagNamed(filter.ExcludeTags))))
	}
	if len(filter.Platforms) > 0 {
		predicates = append(predicates, gameWhere(func(s *sql.Selector) *sql.Predicate {
			return overlaps(s.C(entgame.FieldPlatform), filter.Platforms)
		}))
	}
	if len(filter.ReleasePeriods) > 0 {
		predicates = append(predicates, gameWhere(func(s *sql.Selector) *sql.Predicate {
			return releasedIn(s.C(entgame.FieldReleaseDate), filter.ReleasePeriods)
		}))
	}
	if filter.ReleasedAfter != nil {
		predicates = append(predicates, entgame.ReleaseDateGTE(filter.ReleasedAfter.UTC()))
	}
	if filter.ReleasedBefore != nil {
		predicates = append(predicates, entgame.ReleaseDateLTE(filter.ReleasedBefore.UTC()))
	}
	return predicates
}

func tagNamed(names []string) predicate.Tag {
	matches := make([]predicate.Tag, len(names))
	for i, name := range names {
		matches[i] = tag.NameEqualFold(name)
	}
	return tag.Or(matches...)
}

func ordering(filter game.ListFilter) []entgame.OrderOption {
	direction := sql.OrderDesc()
	if filter.SortOrder == game.SortAscending {
		direction = sql.OrderAsc()
	}
	tiebreak := entgame.ByID(sql.OrderDesc())
	switch filter.SortBy {
	case game.SortByViews:
		return []entgame.OrderOption{entgame.ByViews(direction), tiebreak}
	case game.SortByDownloads:
		return []entgame.OrderOption{entgame.ByDownloads(direction), tiebreak}
	case game.SortByHotScore:
		return []entgame.OrderOption{entgame.ByHotScore(direction), tiebreak}
	default:
		return []entgame.OrderOption{entgame.ByReleaseDate(direction, sql.OrderNullsLast()), tiebreak}
	}
}

func (r *Repository) List(ctx context.Context, filter game.ListFilter, page game.Page) ([]int, int, error) {
	query := r.db(ctx).Game.Query().Where(filterPredicates(filter)...)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count games: %w", err)
	}
	ids, err := query.Order(ordering(filter)...).Offset(page.Offset()).Limit(page.Size).IDs(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list games: %w", err)
	}
	return ids, total, nil
}

func (r *Repository) Listable(ctx context.Context, ids []int, visibility game.Visibility) ([]int, error) {
	if len(ids) == 0 {
		return []int{}, nil
	}
	listable, err := r.db(ctx).Game.Query().Where(entgame.IDIn(ids...)).Where(ListablePredicates(visibility)...).IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("filter listable games: %w", err)
	}
	return listable, nil
}

func (r *Repository) CountListable(ctx context.Context, visibility game.Visibility) (int, error) {
	count, err := r.db(ctx).Game.Query().Where(ListablePredicates(visibility)...).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count listable games: %w", err)
	}
	return count, nil
}

func (r *Repository) ListableAt(ctx context.Context, visibility game.Visibility, offset int) (int, bool, error) {
	ids, err := r.db(ctx).Game.Query().Where(ListablePredicates(visibility)...).Order(entgame.ByID()).Offset(offset).Limit(1).IDs(ctx)
	if err != nil {
		return 0, false, fmt.Errorf("pick listable game: %w", err)
	}
	if len(ids) == 0 {
		return 0, false, nil
	}
	return ids[0], true, nil
}

func (r *Repository) Detail(ctx context.Context, id int) (game.Detail, error) {
	row, err := r.db(ctx).Game.Query().
		Where(entgame.ID(id), entgame.Status(visibleStatus)).
		WithCovers(func(q *ent.GameCoverQuery) { q.Order(gamecover.ByID()) }).
		WithImages(func(q *ent.GameImageQuery) { q.Order(gameimage.ByID()) }).
		WithLink(func(q *ent.GameLinkQuery) { q.Order(gamelink.ByID()) }).
		WithDevelopers(func(q *ent.GameDeveloperRelationQuery) {
			q.Where(gamedeveloperrelation.RoleEQ(developerRole)).Order(gamedeveloperrelation.ByID()).WithDeveloper()
		}).
		WithCharacters(func(q *ent.GameCharacterRelationQuery) {
			q.Order(gamecharacterrelation.ByID()).WithCharacter()
		}).
		WithTagRelations(func(q *ent.GameTagRelationQuery) { q.WithTag() }).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return game.Detail{}, game.ErrNotFound
	}
	if err != nil {
		return game.Detail{}, fmt.Errorf("load game %d: %w", id, err)
	}
	return toDetail(row), nil
}

func (r *Repository) Relations(ctx context.Context, id int) ([]game.Relation, error) {
	rows, err := r.db(ctx).GameRelation.Query().
		Where(gamerelation.FromGameID(id), gamerelation.HasToGameWith(entgame.Status(visibleStatus))).
		Order(gamerelation.ByID()).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load relations of game %d: %w", id, err)
	}
	if len(rows) == 0 {
		return []game.Relation{}, nil
	}
	targets := make([]int, len(rows))
	for i, row := range rows {
		targets[i] = row.ToGameID
	}
	safe, err := r.db(ctx).Game.Query().Where(entgame.IDIn(targets...), SafeForStrictViewers()).IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("classify relation targets of game %d: %w", id, err)
	}
	safeSet := make(map[int]bool, len(safe))
	for _, target := range safe {
		safeSet[target] = true
	}
	relations := make([]game.Relation, len(rows))
	for i, row := range rows {
		relations[i] = game.Relation{ID: row.ID, Kind: string(row.Relation), ToGameID: row.ToGameID, TargetRated: !safeSet[row.ToGameID]}
	}
	return relations, nil
}

func (r *Repository) IncreaseViews(ctx context.Context, id int) error {
	err := r.db(ctx).Game.UpdateOneID(id).AddViews(1).Exec(ctx)
	if postgres.IsNotFound(err) {
		return game.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("increase views of game %d: %w", id, err)
	}
	return nil
}

func (r *Repository) ExternalIDs(ctx context.Context, id int) (game.ExternalIDs, error) {
	row, err := r.db(ctx).Game.Query().Where(entgame.ID(id)).Select(entgame.FieldBID, entgame.FieldVID).Only(ctx)
	if postgres.IsNotFound(err) {
		return game.ExternalIDs{}, game.ErrNotFound
	}
	if err != nil {
		return game.ExternalIDs{}, fmt.Errorf("load external ids of game %d: %w", id, err)
	}
	return game.ExternalIDs{BangumiID: row.BID, VNDBID: row.VID}, nil
}

func SafeForStrictViewers() predicate.Game {
	return entgame.And(entgame.Nsfw(false), entgame.Not(entgame.HasCoversWith(gamecover.SexualGT(0))))
}
