package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aimoderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/aipg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/fieldpermissionmapping"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/malwarescancase"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/tag"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/gameredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

var e2eKeptTables = regexp.MustCompile(`^(schema_migrations|_prisma_migrations|river_.*)$`)

var e2eWhitespace = regexp.MustCompile(`\s+`)

const e2eRedisScanBatch = 500

type e2ePasswordHasher interface {
	Hash(secret string) (string, error)
}

type e2eSeederDeps struct {
	SQL      *sql.DB
	Redis    *redis.Client
	Hasher   e2ePasswordHasher
	Password string
	Now      func() time.Time
	Out      io.Writer
}

type e2eSeeder struct {
	sql      *sql.DB
	ent      *ent.Client
	redis    *redis.Client
	hasher   e2ePasswordHasher
	password string
	now      func() time.Time
	out      io.Writer
}

type e2eSeedResult struct {
	UserIDs       []int
	GameIDs       []int
	PrimaryGameID int
	MalwareGameID int
}

func newE2ESeeder(deps e2eSeederDeps) *e2eSeeder {
	return &e2eSeeder{
		sql:      deps.SQL,
		ent:      postgres.NewClient(deps.SQL),
		redis:    deps.Redis,
		hasher:   deps.Hasher,
		password: deps.Password,
		now:      deps.Now,
		out:      deps.Out,
	}
}

func (s *e2eSeeder) logf(format string, args ...any) {
	_, _ = fmt.Fprintf(s.out, "[e2e-dataset] "+format+"\n", args...)
}

func (s *e2eSeeder) Prepare(ctx context.Context) (e2eSeedResult, error) {
	if err := s.Reset(ctx); err != nil {
		return e2eSeedResult{}, err
	}
	return s.Seed(ctx)
}

func (s *e2eSeeder) Reset(ctx context.Context) error {
	s.logf("Reset started...")
	tables, err := s.businessTables(ctx)
	if err != nil {
		return err
	}
	if len(tables) > 0 {
		if _, err := s.sql.ExecContext(ctx, "TRUNCATE TABLE "+strings.Join(tables, ", ")+" RESTART IDENTITY CASCADE"); err != nil {
			return fmt.Errorf("truncate business tables: %w", err)
		}
		s.logf("Postgres business tables truncated with RESTART IDENTITY CASCADE.")
	}
	removed, err := s.clearRedis(ctx)
	if err != nil {
		return err
	}
	s.logf("Redis keys under %q removed: %d.", s.redis.Key("*"), removed)
	s.logf("Reset completed.")
	return nil
}

func (s *e2eSeeder) clearRedis(ctx context.Context) (int, error) {
	pattern := s.redis.Key("*")
	removed := 0
	iter := s.redis.Scan(ctx, 0, pattern, e2eRedisScanBatch).Iterator()
	batch := make([]string, 0, e2eRedisScanBatch)
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		if err := s.redis.Unlink(ctx, batch...).Err(); err != nil {
			return fmt.Errorf("remove redis keys: %w", err)
		}
		removed += len(batch)
		batch = batch[:0]
		return nil
	}
	for iter.Next(ctx) {
		batch = append(batch, iter.Val())
		if len(batch) == e2eRedisScanBatch {
			if err := flush(); err != nil {
				return removed, err
			}
		}
	}
	if err := iter.Err(); err != nil {
		return removed, fmt.Errorf("scan redis keys: %w", err)
	}
	return removed, flush()
}

func (s *e2eSeeder) businessTables(ctx context.Context) ([]string, error) {
	rows, err := s.sql.QueryContext(ctx, `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
	if err != nil {
		return nil, fmt.Errorf("list business tables: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan table name: %w", err)
		}
		if !e2eKeptTables.MatchString(name) {
			tables = append(tables, pgx.Identifier{"public", name}.Sanitize())
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list business tables: %w", err)
	}
	return tables, nil
}

func (s *e2eSeeder) Seed(ctx context.Context) (e2eSeedResult, error) {
	s.logf("Seed started...")
	data, err := loadE2EDataset()
	if err != nil {
		return e2eSeedResult{}, err
	}
	passwordHash, err := s.hasher.Hash(s.password)
	if err != nil {
		return e2eSeedResult{}, fmt.Errorf("hash e2e password: %w", err)
	}
	var result e2eSeedResult
	err = s.inTransaction(ctx, func(tx *ent.Client) error {
		users, favorites, err := s.seedUsers(ctx, tx, passwordHash)
		if err != nil {
			return err
		}
		result.UserIDs = users
		if err := s.seedPermissionMappings(ctx, tx, data.FieldPermissionMappings); err != nil {
			return err
		}
		if err := s.seedModeration(ctx, tx); err != nil {
			return err
		}
		graph, err := s.seedGameGraph(ctx, tx, data, users[e2eAdminIndex], users[e2eMemberIndex])
		if err != nil {
			return err
		}
		result.GameIDs = graph.gameIDs
		result.PrimaryGameID = graph.primaryGameID
		result.MalwareGameID = graph.malwareGameID
		return s.seedPostGameContent(ctx, tx, e2ePostGameContent{
			adminID:         users[e2eAdminIndex],
			memberID:        users[e2eMemberIndex],
			mutableMemberID: users[e2eMutableIndex],
			memberFavorite:  favorites[e2eMemberIndex],
			primaryGameID:   graph.primaryGameID,
			malwareGameID:   graph.malwareGameID,
			gameIDs:         graph.gameIDs,
		})
	})
	if err != nil {
		return e2eSeedResult{}, err
	}
	if err := s.primeRecentUpdates(ctx, result.GameIDs); err != nil {
		return e2eSeedResult{}, err
	}
	s.logf("Seed completed.")
	s.logf("E2E login user: %s / %s", e2eSeedUsers[e2eMemberIndex].Name, s.password)
	s.logf("Primary game id: %d", result.PrimaryGameID)
	return result, nil
}

func (s *e2eSeeder) inTransaction(ctx context.Context, fn func(tx *ent.Client) error) error {
	tx, err := s.ent.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin seed transaction: %w", err)
	}
	if err := fn(tx.Client()); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit seed transaction: %w", err)
	}
	return nil
}

func (s *e2eSeeder) seedUsers(ctx context.Context, tx *ent.Client, passwordHash string) ([]int, []int, error) {
	userIDs := make([]int, 0, len(e2eSeedUsers))
	favoriteIDs := make([]int, 0, len(e2eSeedUsers))
	for _, seed := range e2eSeedUsers {
		row, err := tx.User.Create().
			SetName(seed.Name).
			SetEmail(seed.Email).
			SetPassword(passwordHash).
			SetRole(seed.Role).
			SetLang(user.LangEn).
			SetContentLimit(seed.ContentLimit).
			SetOnlyGamesWithResources(seed.OnlyGamesWithResources).
			Save(ctx)
		if err != nil {
			return nil, nil, fmt.Errorf("create user %s: %w", seed.Name, err)
		}
		if err := tx.UserUploadQuota.Create().SetUserID(row.ID).SetSize(seed.QuotaSize).SetUsed(0).SetIsFirstGrant(true).Exec(ctx); err != nil {
			return nil, nil, fmt.Errorf("create upload quota of %s: %w", seed.Name, err)
		}
		favorite, err := tx.Favorite.Create().SetUserID(row.ID).SetName(e2eDefaultFavoriteName).SetDefault(true).Save(ctx)
		if err != nil {
			return nil, nil, fmt.Errorf("create default favorite of %s: %w", seed.Name, err)
		}
		userIDs = append(userIDs, row.ID)
		favoriteIDs = append(favoriteIDs, favorite.ID)
	}
	return userIDs, favoriteIDs, nil
}

func (s *e2eSeeder) seedModeration(ctx context.Context, tx *ent.Client) error {
	repo := aipg.NewRepository(tx)
	baseURL := e2eUnreachableAIBaseURL
	provider, err := repo.CreateProvider(ctx, ai.NewProvider{Name: "e2e-unreachable", Kind: ai.KindCompatible, BaseURL: &baseURL, APIKey: e2eUnreachableAIKey, PriceMultiplier: 1})
	if err != nil {
		return fmt.Errorf("seed ai provider: %w", err)
	}
	scenes := []struct {
		scene      string
		model      string
		protocol   ai.Protocol
		moderation bool
	}{
		{scene: aimoderation.ScreenScene, model: "omni-moderation-latest", protocol: ai.ProtocolModeration, moderation: true},
		{scene: aimoderation.ReviewScene, model: "gpt-5-mini", protocol: ai.ProtocolChat},
	}
	for _, item := range scenes {
		modelID, err := repo.CreateModel(ctx, ai.NewModel{Key: item.model, Name: item.model, Capabilities: ai.Capabilities{Moderation: item.moderation, Temperature: !item.moderation}})
		if err != nil {
			return fmt.Errorf("seed ai model %s: %w", item.model, err)
		}
		if _, err := repo.CreateRoute(ctx, ai.NewRoute{ModelID: modelID, ProviderID: provider, UpstreamID: item.model, Protocol: item.protocol}); err != nil {
			return fmt.Errorf("seed ai route %s: %w", item.model, err)
		}
		if err := repo.SaveSceneConfig(ctx, ai.SceneConfig{Key: item.scene, ModelID: &modelID}); err != nil {
			return fmt.Errorf("seed ai scene %s: %w", item.scene, err)
		}
	}
	return nil
}

func (s *e2eSeeder) seedPermissionMappings(ctx context.Context, tx *ent.Client, rows []e2ePermissionMappingRow) error {
	creates := make([]*ent.FieldPermissionMappingCreate, len(rows))
	for i, row := range rows {
		creates[i] = tx.FieldPermissionMapping.Create().
			SetEntity(fieldpermissionmapping.Entity(row.Entity)).
			SetField(row.Field).
			SetBitIndex(row.BitIndex).
			SetIsRelation(row.IsRelation)
	}
	if err := tx.FieldPermissionMapping.CreateBulk(creates...).Exec(ctx); err != nil {
		return fmt.Errorf("create field permission mappings: %w", err)
	}
	return nil
}

type e2eGameGraph struct {
	gameIDs       []int
	primaryGameID int
	malwareGameID int
}

func (s *e2eSeeder) seedGameGraph(ctx context.Context, tx *ent.Client, data e2eDataset, adminID, memberID int) (e2eGameGraph, error) {
	developerIDs, err := s.seedDevelopers(ctx, tx, data.Developers)
	if err != nil {
		return e2eGameGraph{}, err
	}
	characterIDs, err := s.seedCharacters(ctx, tx, data.Characters)
	if err != nil {
		return e2eGameGraph{}, err
	}
	covers := e2eGroupByGame(data.Covers, func(row e2eCoverRow) int { return row.GameID })
	images := e2eGroupByGame(data.Images, func(row e2eImageRow) int { return row.GameID })
	links := e2eGroupByGame(data.Links, func(row e2eLinkRow) int { return row.GameID })
	developerRelations := e2eGroupByGame(data.DeveloperRelations, func(row e2eDeveloperRelationRow) int { return row.GameID })
	characterRelations := e2eGroupByGame(data.CharacterRelations, func(row e2eCharacterRelationRow) int { return row.GameID })

	gameIDs := make(map[int]int, len(data.Games))
	graph := e2eGameGraph{gameIDs: make([]int, 0, len(data.Games))}
	for index, game := range data.Games {
		creatorID := memberID
		if index == 0 {
			creatorID = adminID
		}
		id, err := s.createGame(ctx, tx, game, creatorID)
		if err != nil {
			return e2eGameGraph{}, err
		}
		if err := s.createGameChildren(ctx, tx, id, covers[game.ID], images[game.ID], links[game.ID]); err != nil {
			return e2eGameGraph{}, err
		}
		if err := s.createGameCredits(ctx, tx, id, developerRelations[game.ID], developerIDs, characterRelations[game.ID], characterIDs); err != nil {
			return e2eGameGraph{}, err
		}
		if err := tx.Game.UpdateOneID(id).SetHID(id).Exec(ctx); err != nil {
			return e2eGameGraph{}, fmt.Errorf("link game %d to itself: %w", id, err)
		}
		if err := tx.CatalogSourceLink.Create().SetSource(e2eHikarinagiSource).SetEntity(e2eCatalogEntityGame).SetExternalID(fmt.Sprint(id)).SetLocalID(id).Exec(ctx); err != nil {
			return e2eGameGraph{}, fmt.Errorf("create catalog link of game %d: %w", id, err)
		}
		if err := s.tagGame(ctx, tx, id, game.Tags); err != nil {
			return e2eGameGraph{}, err
		}
		gameIDs[game.ID] = id
		graph.gameIDs = append(graph.gameIDs, id)
	}
	primary, ok := gameIDs[e2ePrimaryFixtureGameID]
	if !ok {
		primary = graph.gameIDs[0]
	}
	malware, ok := gameIDs[e2eMalwareFixtureGameID]
	if !ok {
		malware = graph.gameIDs[0]
	}
	graph.primaryGameID = primary
	graph.malwareGameID = malware
	return graph, nil
}

func (s *e2eSeeder) seedDevelopers(ctx context.Context, tx *ent.Client, rows []e2eDeveloperRow) (map[int]int, error) {
	ids := make(map[int]int, len(rows))
	for _, row := range rows {
		created, err := tx.GameDeveloper.Create().
			SetNillableBID(row.BID).
			SetNillableVID(row.VID).
			SetName(e2eOrEmpty(row.Name)).
			SetAliases(pgvalue.Strings(e2eNonNilStrings(row.Aliases))).
			SetNillableLogo(row.Logo).
			SetIntroJp(e2eOrEmpty(row.IntroJP)).
			SetIntroZh(e2eOrEmpty(row.IntroZH)).
			SetIntroEn(e2eOrEmpty(row.IntroEN)).
			SetNillableWebsite(row.Website).
			SetExtraInfo(e2eJSONOrEmptyArray(row.ExtraInfo)).
			Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("create developer %d: %w", row.ID, err)
		}
		ids[row.ID] = created.ID
	}
	for _, row := range rows {
		if row.ParentDeveloperID == nil {
			continue
		}
		current, parent := ids[row.ID], ids[*row.ParentDeveloperID]
		if current == 0 || parent == 0 {
			continue
		}
		if err := tx.GameDeveloper.UpdateOneID(current).SetParentDeveloperID(parent).Exec(ctx); err != nil {
			return nil, fmt.Errorf("set parent of developer %d: %w", current, err)
		}
	}
	return ids, nil
}

func (s *e2eSeeder) seedCharacters(ctx context.Context, tx *ent.Client, rows []e2eCharacterRow) (map[int]int, error) {
	ids := make(map[int]int, len(rows))
	for _, row := range rows {
		create := tx.GameCharacter.Create().
			SetNillableBID(row.BID).
			SetNillableVID(row.VID).
			SetNillableImage(row.Image).
			SetNameJp(e2eOrEmpty(row.NameJP)).
			SetNillableNameZh(row.NameZH).
			SetNillableNameEn(row.NameEN).
			SetAliases(pgvalue.Strings(e2eNonNilStrings(row.Aliases))).
			SetIntroJp(e2eOrEmpty(row.IntroJP)).
			SetIntroZh(e2eOrEmpty(row.IntroZH)).
			SetIntroEn(e2eOrEmpty(row.IntroEN)).
			SetNillableHeight(row.Height).
			SetNillableWeight(row.Weight).
			SetNillableBust(row.Bust).
			SetNillableWaist(row.Waist).
			SetNillableHips(row.Hips).
			SetNillableCup(row.Cup).
			SetNillableAge(row.Age).
			SetBirthday(pgvalue.Ints(e2eNonNilInts(row.Birthday))).
			SetGender(pgvalue.Strings(e2eNonNilStrings(row.Gender)))
		if row.BloodType != nil {
			create.SetBloodType(gamecharacter.BloodType(*row.BloodType))
		}
		created, err := create.Save(ctx)
		if err != nil {
			return nil, fmt.Errorf("create character %d: %w", row.ID, err)
		}
		ids[row.ID] = created.ID
	}
	return ids, nil
}

func (s *e2eSeeder) createGame(ctx context.Context, tx *ent.Client, game e2eGameRow, creatorID int) (int, error) {
	create := tx.Game.Create().
		SetCreatorID(creatorID).
		SetNillableVID(game.VID).
		SetNillableBID(game.BID).
		SetTitleJp(e2eOrEmpty(game.TitleJP)).
		SetTitleZh(e2eOrEmpty(game.TitleZH)).
		SetTitleEn(e2eOrEmpty(game.TitleEN)).
		SetAliases(pgvalue.Strings(e2eNonNilStrings(game.Aliases))).
		SetIntroJp(e2eOrEmpty(game.IntroJP)).
		SetIntroZh(e2eOrEmpty(game.IntroZH)).
		SetIntroEn(e2eOrEmpty(game.IntroEN)).
		SetNillableReleaseDate(e2eUtc(game.ReleaseDate)).
		SetReleaseDateTba(game.ReleaseDateTBA != nil && *game.ReleaseDateTBA).
		SetExtraInfo(e2eJSONOrEmptyArray(game.ExtraInfo)).
		SetStaffs(e2eJSONOrEmptyArray(game.Staffs)).
		SetNsfw(game.NSFW != nil && *game.NSFW).
		SetNillableType(game.Type).
		SetPlatform(pgvalue.Strings(e2eNonNilStrings(game.Platform))).
		SetStatus(e2eValueOr(game.Status, 1)).
		SetHotScore(e2eValueOr(game.HotScore, 0)).
		SetViews(e2eValueOr(game.Views, 0)).
		SetDownloads(e2eValueOr(game.Downloads, 0))
	row, err := create.Save(ctx)
	if err != nil {
		return 0, fmt.Errorf("create game %d: %w", game.ID, err)
	}
	return row.ID, nil
}

func (s *e2eSeeder) createGameChildren(ctx context.Context, tx *ent.Client, gameID int, covers []e2eCoverRow, images []e2eImageRow, links []e2eLinkRow) error {
	for _, cover := range covers {
		err := tx.GameCover.Create().
			SetGameID(gameID).
			SetLanguage(cover.Language).
			SetURL(cover.URL).
			SetType(cover.Type).
			SetDims(pgvalue.Ints(e2eNonNilInts(cover.Dims))).
			SetSexual(cover.Sexual).
			SetViolence(cover.Violence).
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("create cover of game %d: %w", gameID, err)
		}
	}
	for _, image := range images {
		err := tx.GameImage.Create().
			SetGameID(gameID).
			SetURL(image.URL).
			SetDims(pgvalue.Ints(e2eNonNilInts(image.Dims))).
			SetSexual(image.Sexual).
			SetViolence(image.Violence).
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("create image of game %d: %w", gameID, err)
		}
	}
	for _, link := range links {
		if err := tx.GameLink.Create().SetGameID(gameID).SetURL(link.URL).SetLabel(link.Label).SetName(link.Name).Exec(ctx); err != nil {
			return fmt.Errorf("create link of game %d: %w", gameID, err)
		}
	}
	return nil
}

func (s *e2eSeeder) createGameCredits(ctx context.Context, tx *ent.Client, gameID int, developers []e2eDeveloperRelationRow, developerIDs map[int]int, characters []e2eCharacterRelationRow, characterIDs map[int]int) error {
	for _, relation := range developers {
		developerID, ok := developerIDs[relation.DeveloperID]
		if !ok {
			s.logf("WARN: Missing mapped developer id for relation %d (developer_id=%d)", relation.ID, relation.DeveloperID)
			continue
		}
		if err := tx.GameDeveloperRelation.Create().SetGameID(gameID).SetDeveloperID(developerID).SetNillableRole(relation.Role).Exec(ctx); err != nil {
			return fmt.Errorf("create developer relation of game %d: %w", gameID, err)
		}
	}
	for _, relation := range characters {
		characterID, ok := characterIDs[relation.CharacterID]
		if !ok {
			s.logf("WARN: Missing mapped character id for relation %d (character_id=%d)", relation.ID, relation.CharacterID)
			continue
		}
		create := tx.GameCharacterRelation.Create().
			SetGameID(gameID).
			SetCharacterID(characterID).
			SetNillableImage(relation.Image).
			SetNillableActor(relation.Actor)
		if relation.Role != nil {
			create.SetRole(gamecharacterrelation.Role(*relation.Role))
		}
		if err := create.Exec(ctx); err != nil {
			return fmt.Errorf("create character relation of game %d: %w", gameID, err)
		}
	}
	return nil
}

func (s *e2eSeeder) tagGame(ctx context.Context, tx *ent.Client, gameID int, tags []string) error {
	if len(tags) > e2eSeededTagsPerGame {
		tags = tags[:e2eSeededTagsPerGame]
	}
	for _, raw := range tags {
		name := e2eWhitespace.ReplaceAllString(strings.TrimSpace(strings.ToLower(raw)), " ")
		row, err := tx.Tag.Query().Where(tag.Name(name)).Only(ctx)
		if ent.IsNotFound(err) {
			row, err = tx.Tag.Create().SetName(name).SetAliases(pgvalue.Strings{}).Save(ctx)
		}
		if err != nil {
			return fmt.Errorf("resolve tag %q: %w", name, err)
		}
		if err := tx.GameTagRelation.Create().SetGameID(gameID).SetTagID(row.ID).Exec(ctx); err != nil {
			return fmt.Errorf("tag game %d with %q: %w", gameID, name, err)
		}
		if err := tx.Tag.UpdateOneID(row.ID).AddCount(1).Exec(ctx); err != nil {
			return fmt.Errorf("count tag %q: %w", name, err)
		}
	}
	return nil
}

type e2ePostGameContent struct {
	adminID         int
	memberID        int
	mutableMemberID int
	memberFavorite  int
	primaryGameID   int
	malwareGameID   int
	gameIDs         []int
}

func (s *e2eSeeder) seedPostGameContent(ctx context.Context, tx *ent.Client, content e2ePostGameContent) error {
	rootID, err := s.seedComments(ctx, tx, content)
	if err != nil {
		return err
	}
	secondGameID := content.gameIDs[0]
	if len(content.gameIDs) > 1 {
		secondGameID = content.gameIDs[1]
	}
	err = tx.Activity.CreateBulk(
		tx.Activity.Create().SetType(activity.TypeGAME_CREATE).SetUserID(content.adminID).SetGameID(content.gameIDs[0]),
		tx.Activity.Create().SetType(activity.TypeGAME_CREATE).SetUserID(content.adminID).SetGameID(secondGameID),
		tx.Activity.Create().SetType(activity.TypeCOMMENT).SetUserID(content.memberID).SetGameID(content.primaryGameID).SetCommentID(rootID),
	).Exec(ctx)
	if err != nil {
		return fmt.Errorf("create activities: %w", err)
	}
	if err := tx.FavoriteItem.Create().SetFavoriteID(content.memberFavorite).SetGameID(content.primaryGameID).SetNote(e2eFavoriteItemNote).Exec(ctx); err != nil {
		return fmt.Errorf("create favorite item: %w", err)
	}
	if _, _, err := s.createResource(ctx, tx, content.primaryGameID, content.mutableMemberID, e2eReportableResource, e2eReportableFile); err != nil {
		return err
	}
	resourceID, file, err := s.createResource(ctx, tx, content.malwareGameID, content.adminID, e2eMalwareResource, e2eMalwareFile)
	if err != nil {
		return err
	}
	err = tx.MalwareScanCase.Create().
		SetFileID(file.ID).
		SetResourceID(resourceID).
		SetGameID(content.malwareGameID).
		SetUploaderID(content.adminID).
		SetReviewDeadline(s.now().UTC().Add(e2eMalwareReviewDeadline)).
		SetDetector(e2eSeededMalwareCase.Detector).
		SetDetectedViruses(pgvalue.Strings(e2eSeededMalwareCase.DetectedViruses)).
		SetScanResult(e2eSeededMalwareCase.ScanResult).
		SetScanLogPath(e2eSeededMalwareCase.ScanLogPath).
		SetScanLogExcerpt(e2eSeededMalwareCase.ScanLogExcerpt).
		SetFileName(file.FileName).
		SetFileSize(file.FileSize).
		SetHashAlgorithm(malwarescancase.HashAlgorithm(file.HashAlgorithm)).
		SetFileHash(file.FileHash).
		SetNotifyUploaderOnAllow(e2eSeededMalwareCase.NotifyUploaderOnAllow).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("create malware scan case: %w", err)
	}
	return nil
}

func (s *e2eSeeder) seedComments(ctx context.Context, tx *ent.Client, content e2ePostGameContent) (int, error) {
	rootContent, err := e2eLexicalParagraph(e2eRootCommentText)
	if err != nil {
		return 0, fmt.Errorf("encode root comment: %w", err)
	}
	replyContent, err := e2eLexicalParagraph(e2eReplyCommentText)
	if err != nil {
		return 0, fmt.Errorf("encode reply comment: %w", err)
	}
	root, err := tx.Comment.Create().
		SetContent(rootContent).
		SetHTML(e2eRootCommentHTML).
		SetGameID(content.primaryGameID).
		SetCreatorID(content.memberID).
		SetStatus(1).
		Save(ctx)
	if err != nil {
		return 0, fmt.Errorf("create root comment: %w", err)
	}
	err = tx.Comment.Create().
		SetContent(replyContent).
		SetHTML(e2eReplyCommentHTML).
		SetGameID(content.primaryGameID).
		SetCreatorID(content.adminID).
		SetParentID(root.ID).
		SetRootID(root.ID).
		SetStatus(1).
		Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("create reply comment: %w", err)
	}
	if err := tx.Comment.UpdateOneID(root.ID).SetReplyCount(1).Exec(ctx); err != nil {
		return 0, fmt.Errorf("count root comment replies: %w", err)
	}
	return root.ID, nil
}

func (s *e2eSeeder) createResource(ctx context.Context, tx *ent.Client, gameID, creatorID int, resource e2eSeededResource, file e2eSeededFile) (int, *ent.GameDownloadResourceFile, error) {
	row, err := tx.GameDownloadResource.Create().
		SetGameID(gameID).
		SetCreatorID(creatorID).
		SetPlatform(pgvalue.Strings(resource.Platform)).
		SetLanguage(pgvalue.Strings(resource.Language)).
		SetNote(resource.Note).
		Save(ctx)
	if err != nil {
		return 0, nil, fmt.Errorf("create download resource for game %d: %w", gameID, err)
	}
	created, err := tx.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(row.ID).
		SetCreatorID(creatorID).
		SetType(file.Type).
		SetFileName(file.FileName).
		SetNillableFilePath(file.FilePath).
		SetNillableS3FileKey(file.S3FileKey).
		SetFileSize(file.FileSize).
		SetFileContentType(file.FileContentType).
		SetHashAlgorithm(gamedownloadresourcefile.HashAlgorithmSha256).
		SetFileHash(file.FileHash).
		SetFileStatus(file.FileStatus).
		SetFileCheckStatus(file.FileCheckStatus).
		SetIsVirusFalsePositive(false).
		Save(ctx)
	if err != nil {
		return 0, nil, fmt.Errorf("create download file %s: %w", file.FileName, err)
	}
	return row.ID, created, nil
}

func (s *e2eSeeder) primeRecentUpdates(ctx context.Context, gameIDs []int) error {
	recent := gameredis.NewRecentUpdates(s.redis)
	now := s.now()
	for index, gameID := range gameIDs {
		if err := recent.Add(ctx, gameID, now.Add(-time.Duration(index)*time.Millisecond)); err != nil {
			return err
		}
	}
	s.logf("Primed redis sorted set %q with %d game ids.", s.redis.Key("game:recent_update"), len(gameIDs))
	return nil
}

func e2eNonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func e2eNonNilInts(values []int) []int {
	if values == nil {
		return []int{}
	}
	return values
}

func e2eValueOr[T any](value *T, fallback T) T {
	if value == nil {
		return fallback
	}
	return *value
}

func e2eUtc(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	converted := value.UTC()
	return &converted
}
