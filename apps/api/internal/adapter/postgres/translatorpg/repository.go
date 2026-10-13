package translatorpg

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcetranslator"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	enttranslator "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

const nameKeyUnique = "translators_name_key_key"

const visibleWorks = `
  SELECT c.translator_id, COUNT(DISTINCT r.game_id) AS works
  FROM game_download_resource_translators c
  JOIN game_download_resources r ON r.id = c.resource_id AND r.status = 1 AND r.published_at IS NOT NULL
  JOIN games g ON g.id = r.game_id AND g.status = 1
  GROUP BY c.translator_id`

const named = `($1 = '' OR strpos(lower(t.name), lower($1)) > 0 OR EXISTS (SELECT 1 FROM unnest(t.aliases) AS alias(value) WHERE strpos(lower(alias.value), lower($1)) > 0))`

const summaryColumns = `SELECT t.id, t.name, t.aliases, COALESCE(w.works, 0) FROM translators t LEFT JOIN (` + visibleWorks + `) w ON w.translator_id = t.id`

const summaryOrder = ` ORDER BY COALESCE(w.works, 0) DESC, t.name COLLATE "C", t.id`

const listQuery = summaryColumns + ` WHERE ` + named + ` AND COALESCE(w.works, 0) > 0` + summaryOrder + ` OFFSET $2 LIMIT $3`

const listCountQuery = `SELECT COUNT(*) FROM translators t JOIN (` + visibleWorks + `) w ON w.translator_id = t.id WHERE ` + named

const suggestQuery = summaryColumns + ` WHERE ` + named + summaryOrder + ` LIMIT $2`

const worksQuery = `
SELECT COUNT(DISTINCT r.game_id)
FROM game_download_resource_translators c
JOIN game_download_resources r ON r.id = c.resource_id AND r.status = 1 AND r.published_at IS NOT NULL
JOIN games g ON g.id = r.game_id AND g.status = 1
WHERE c.translator_id = $1`

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Get(ctx context.Context, id int) (translator.Translator, error) {
	row, err := r.db(ctx).Translator.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return translator.Translator{}, translator.ErrNotFound
	}
	if err != nil {
		return translator.Translator{}, fmt.Errorf("get translator %d: %w", id, err)
	}
	return toTranslator(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (translator.Translator, error) {
	row, err := r.db(ctx).Translator.Query().Where(enttranslator.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return translator.Translator{}, translator.ErrNotFound
	}
	if err != nil {
		return translator.Translator{}, fmt.Errorf("lock translator %d: %w", id, err)
	}
	return toTranslator(row), nil
}

func aliasedBy(keys []string) predicate.Translator {
	return predicate.Translator(func(s *entsql.Selector) {
		s.Where(entsql.P(func(b *entsql.Builder) {
			b.Ident(s.C(enttranslator.FieldAliasKeys)).WriteString(" && ").Arg(pgvalue.Strings(keys)).WriteString("::text[]")
		}))
	})
}

func (r *Repository) FindByKeys(ctx context.Context, keys []string) ([]translator.Translator, error) {
	if len(keys) == 0 {
		return []translator.Translator{}, nil
	}
	rows, err := r.db(ctx).Translator.Query().
		Where(enttranslator.Or(enttranslator.NameKeyIn(keys...), aliasedBy(keys))).
		Order(enttranslator.ByID()).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("find translators by key: %w", err)
	}
	found := make([]translator.Translator, len(rows))
	for i, row := range rows {
		found[i] = toTranslator(row)
	}
	return found, nil
}

func (r *Repository) Ensure(ctx context.Context, in translator.NewTranslator) (translator.Translator, error) {
	key := translator.Key(in.Name)
	err := r.db(ctx).Translator.Create().
		SetName(in.Name).
		SetNameKey(key).
		SetNillableCreatorID(in.CreatorID).
		OnConflictColumns(enttranslator.FieldNameKey).
		DoNothing().
		Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return translator.Translator{}, fmt.Errorf("ensure translator: %w", err)
	}
	row, err := r.db(ctx).Translator.Query().Where(enttranslator.NameKey(key)).Only(ctx)
	if err != nil {
		return translator.Translator{}, fmt.Errorf("load ensured translator: %w", err)
	}
	return toTranslator(row), nil
}

func (r *Repository) Update(ctx context.Context, id int, changes translator.Changes) error {
	update := r.db(ctx).Translator.UpdateOneID(id)
	if changes.Name != nil {
		update.SetName(*changes.Name).SetNameKey(translator.Key(*changes.Name))
	}
	if changes.Aliases != nil {
		keys := make([]string, len(*changes.Aliases))
		for i, alias := range *changes.Aliases {
			keys[i] = translator.Key(alias)
		}
		update.SetAliases(pgvalue.Strings(*changes.Aliases)).SetAliasKeys(pgvalue.Strings(keys))
	}
	if changes.Homepage.Set {
		if changes.Homepage.Value == nil {
			update.ClearHomepage()
		} else {
			update.SetHomepage(*changes.Homepage.Value)
		}
	}
	err := update.Exec(ctx)
	switch {
	case postgres.IsNotFound(err):
		return translator.ErrNotFound
	case postgres.IsUniqueViolation(err, nameKeyUnique):
		return translator.ErrNameTaken
	case err != nil:
		return fmt.Errorf("update translator %d: %w", id, err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).Translator.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return translator.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete translator %d: %w", id, err)
	}
	return nil
}

func (r *Repository) List(ctx context.Context, query string, page translator.Page) ([]translator.Summary, int, error) {
	total, err := r.count(ctx, listCountQuery, query)
	if err != nil {
		return nil, 0, fmt.Errorf("count translators: %w", err)
	}
	rows, err := r.db(ctx).QueryContext(ctx, listQuery, query, page.Offset(), page.Size)
	if err != nil {
		return nil, 0, fmt.Errorf("list translators: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	summaries, err := scanSummaries(rows)
	if err != nil {
		return nil, 0, err
	}
	return summaries, total, nil
}

func (r *Repository) Suggest(ctx context.Context, query string, limit int) ([]translator.Summary, error) {
	rows, err := r.db(ctx).QueryContext(ctx, suggestQuery, query, limit)
	if err != nil {
		return nil, fmt.Errorf("suggest translators: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	return scanSummaries(rows)
}

func (r *Repository) CountWorks(ctx context.Context, id int) (int, error) {
	works, err := r.count(ctx, worksQuery, id)
	if err != nil {
		return 0, fmt.Errorf("count works of translator %d: %w", id, err)
	}
	return works, nil
}

func (r *Repository) count(ctx context.Context, query string, args ...any) (int, error) {
	rows, err := r.db(ctx).QueryContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	defer func() {
		_ = rows.Close()
	}()
	return scanCount(rows)
}

func (r *Repository) Reassign(ctx context.Context, fromID, toID int) error {
	held, err := r.db(ctx).GameDownloadResourceTranslator.Query().
		Where(gamedownloadresourcetranslator.TranslatorID(toID)).
		Select(gamedownloadresourcetranslator.FieldResourceID).
		Ints(ctx)
	if err != nil {
		return fmt.Errorf("list credits of translator %d: %w", toID, err)
	}
	if len(held) > 0 {
		if _, err := r.db(ctx).GameDownloadResourceTranslator.Delete().
			Where(gamedownloadresourcetranslator.TranslatorID(fromID), gamedownloadresourcetranslator.ResourceIDIn(held...)).
			Exec(ctx); err != nil {
			return fmt.Errorf("drop doubled credits of translator %d: %w", fromID, err)
		}
	}
	if err := r.db(ctx).GameDownloadResourceTranslator.Update().
		Where(gamedownloadresourcetranslator.TranslatorID(fromID)).
		SetTranslatorID(toID).
		Exec(ctx); err != nil {
		return fmt.Errorf("move credits of translator %d: %w", fromID, err)
	}
	return nil
}
