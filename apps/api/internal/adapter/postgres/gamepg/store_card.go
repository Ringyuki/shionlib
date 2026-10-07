package gamepg

import (
	"context"
	"fmt"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const developerRole = "开发"

const cardTagsQuery = `
SELECT ranked.game_id, ranked.id, ranked.name
FROM (
  SELECT r.game_id, t.id, t.name, ROW_NUMBER() OVER (PARTITION BY r.game_id ORDER BY t.count DESC, t.id ASC) AS position
  FROM game_tag_relations r
  JOIN tags t ON t.id = r.tag_id
  WHERE r.game_id = ANY($1::int[])
    AND t.count <= CEIL($3::float8 * (SELECT COUNT(*) FROM games))
    AND t.name !~ $4
) ranked
WHERE ranked.position <= $2
ORDER BY ranked.game_id, ranked.position`

type CardStore struct {
	client *ent.Client
}

func NewCardStore(client *ent.Client) *CardStore {
	return &CardStore{client: client}
}

func (s *CardStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *CardStore) Cards(ctx context.Context, ids []int) ([]game.Card, error) {
	rows, err := s.db(ctx).Game.Query().
		Where(entgame.IDIn(ids...)).
		WithCovers(func(q *ent.GameCoverQuery) {
			q.Order(ent.Asc(gamecover.FieldID))
		}).
		WithDevelopers(func(q *ent.GameDeveloperRelationQuery) {
			q.Where(gamedeveloperrelation.RoleEQ(developerRole)).Order(ent.Asc(gamedeveloperrelation.FieldID)).WithDeveloper()
		}).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load game cards: %w", err)
	}
	cards := make([]game.Card, 0, len(rows))
	if len(rows) == 0 {
		return cards, nil
	}
	found := make([]int, len(rows))
	for i, row := range rows {
		found[i] = row.ID
	}
	resources, err := s.publicResources(ctx, found)
	if err != nil {
		return nil, err
	}
	tags, err := s.tellingTags(ctx, found)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		card := toCard(row)
		card.Resources = toResourceSummary(resources[row.ID])
		card.Tags = tags[row.ID]
		if card.Tags == nil {
			card.Tags = []game.TagRef{}
		}
		cards = append(cards, card)
	}
	return cards, nil
}

func (s *CardStore) publicResources(ctx context.Context, gameIDs []int) (map[int][]publicResourceRecord, error) {
	var records []publicResourceRecord
	err := s.db(ctx).GameDownloadResource.Query().
		Where(gamedownloadresource.GameIDIn(gameIDs...), PublicResource()).
		Modify(func(selector *sql.Selector) {
			selector.Select(
				selector.C(gamedownloadresource.FieldID),
				selector.C(gamedownloadresource.FieldGameID),
				selector.C(gamedownloadresource.FieldPlatform),
				selector.C(gamedownloadresource.FieldLanguage),
				selector.C(gamedownloadresource.FieldDownloads),
				selector.C(gamedownloadresource.FieldCreated),
			).AppendSelectExprAs(publicFileSize(selector), "size")
		}).
		Scan(ctx, &records)
	if err != nil {
		return nil, fmt.Errorf("load public resources of game cards: %w", err)
	}
	byGame := make(map[int][]publicResourceRecord, len(gameIDs))
	for _, record := range records {
		byGame[record.GameID] = append(byGame[record.GameID], record)
	}
	return byGame, nil
}

func publicFileSize(resources *sql.Selector) sql.Querier {
	files := sql.Table(gamedownloadresourcefile.Table)
	total := sql.Select(sql.Sum(files.C(gamedownloadresourcefile.FieldFileSize))).
		From(files).
		Where(sql.ColumnsEQ(files.C(gamedownloadresourcefile.FieldGameDownloadResourceID), resources.C(gamedownloadresource.FieldID)))
	PublicFile()(total)
	return sql.ExprFunc(func(b *sql.Builder) {
		b.WriteString("COALESCE(").Wrap(func(b *sql.Builder) { b.Join(total) }).WriteString(", 0)::bigint")
	})
}

func (s *CardStore) tellingTags(ctx context.Context, gameIDs []int) (map[int][]game.TagRef, error) {
	rows, err := s.db(ctx).QueryContext(ctx, cardTagsQuery, pgvalue.Ints(gameIDs), game.CardTagLimit, game.CommonTagShare, game.DateTagPattern)
	if err != nil {
		return nil, fmt.Errorf("load tags of game cards: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	tags := make(map[int][]game.TagRef, len(gameIDs))
	for rows.Next() {
		var (
			gameID int
			tag    game.TagRef
		)
		if err := rows.Scan(&gameID, &tag.ID, &tag.Name); err != nil {
			return nil, fmt.Errorf("scan tags of game cards: %w", err)
		}
		tags[gameID] = append(tags[gameID], tag)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read tags of game cards: %w", err)
	}
	return tags, nil
}

func (s *CardStore) Exists(ctx context.Context, id int) (bool, error) {
	exists, err := s.db(ctx).Game.Query().Where(entgame.ID(id)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check game existence: %w", err)
	}
	return exists, nil
}
