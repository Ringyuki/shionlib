package gamepg

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsourcelink"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefilehistory"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

const uniqueExternalIDs = "games_b_id_v_id_key"

var adminSortFields = map[game.AdminSortField]string{
	game.AdminSortByID:        entgame.FieldID,
	game.AdminSortByTitleJP:   entgame.FieldTitleJp,
	game.AdminSortByViews:     entgame.FieldViews,
	game.AdminSortByDownloads: entgame.FieldDownloads,
	game.AdminSortByCreated:   entgame.FieldCreated,
	game.AdminSortByUpdated:   entgame.FieldUpdated,
}

var adminListFields = []string{
	entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn, entgame.FieldStatus,
	entgame.FieldViews, entgame.FieldDownloads, entgame.FieldNsfw, entgame.FieldCreated, entgame.FieldUpdated,
	entgame.FieldCreatorID,
}

type AdminStore struct {
	client *ent.Client
}

func NewAdminStore(client *ent.Client) *AdminStore {
	return &AdminStore{client: client}
}

func (s *AdminStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *AdminStore) Search(ctx context.Context, filter game.AdminFilter, page game.Page) ([]game.AdminEntry, int, error) {
	query := s.db(ctx).Game.Query()
	if filter.Status != nil {
		query.Where(entgame.Status(int(*filter.Status)))
	}
	if filter.Search != "" {
		matches := []predicate.Game{
			entgame.TitleJpContainsFold(filter.Search),
			entgame.TitleZhContainsFold(filter.Search),
			entgame.TitleEnContainsFold(filter.Search),
		}
		if id, err := strconv.Atoi(filter.Search); err == nil && id > 0 {
			matches = append(matches, entgame.ID(id))
		}
		query.Where(entgame.Or(matches...))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count games: %w", err)
	}
	field, ok := adminSortFields[filter.SortBy]
	if !ok {
		field = entgame.FieldID
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	rows, err := query.
		Select(adminListFields...).
		WithCreator(func(q *ent.UserQuery) { q.Select(entuser.FieldID, entuser.FieldName) }).
		Order(order(field), order(entgame.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("search games: %w", err)
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	covers, err := s.firstCovers(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	resources, err := s.publishedResources(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	sources, err := s.sourceRefs(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	entries := make([]game.AdminEntry, len(rows))
	for i, row := range rows {
		entry := game.AdminEntry{
			ID:        row.ID,
			TitleJP:   row.TitleJp,
			TitleZH:   row.TitleZh,
			TitleEN:   row.TitleEn,
			Status:    game.Status(row.Status),
			Views:     row.Views,
			Downloads: row.Downloads,
			Resources: resources[row.ID],
			NSFW:      row.Nsfw,
			Created:   row.Created,
			Updated:   row.Updated,
			Creator:   game.CreatorRef{ID: row.CreatorID},
		}
		if creator := row.Edges.Creator; creator != nil {
			entry.Creator.Name = creator.Name
		}
		if cover, ok := covers[row.ID]; ok {
			entry.Cover = &cover
		}
		if ref, ok := sources[row.ID]; ok {
			entry.Source = &ref
		}
		entries[i] = entry
	}
	return entries, total, nil
}

func (s *AdminStore) publishedResources(ctx context.Context, gameIDs []int) (map[int]int, error) {
	counts := map[int]int{}
	if len(gameIDs) == 0 {
		return counts, nil
	}
	var rows []struct {
		GameID int `json:"game_id"`
		Count  int `json:"count"`
	}
	err := s.db(ctx).GameDownloadResource.Query().
		Where(
			gamedownloadresource.GameIDIn(gameIDs...),
			gamedownloadresource.Status(download.ResourceActive),
			gamedownloadresource.PublishedAtNotNil(),
		).
		GroupBy(gamedownloadresource.FieldGameID).
		Aggregate(ent.Count()).
		Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("count published resources: %w", err)
	}
	for _, row := range rows {
		counts[row.GameID] = row.Count
	}
	return counts, nil
}

func (s *AdminStore) sourceRefs(ctx context.Context, gameIDs []int) (map[int]game.SourceRef, error) {
	refs := map[int]game.SourceRef{}
	if len(gameIDs) == 0 {
		return refs, nil
	}
	links, err := s.db(ctx).CatalogSourceLink.Query().
		Where(
			catalogsourcelink.Entity(string(catalog.EntityGame)),
			catalogsourcelink.LocalIDIn(gameIDs...),
			catalogsourcelink.ExcludedAtIsNil(),
		).
		Order(ent.Asc(catalogsourcelink.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load game sources: %w", err)
	}
	for _, link := range links {
		if _, seen := refs[link.LocalID]; !seen {
			refs[link.LocalID] = game.SourceRef{Source: link.Source, ExternalID: link.ExternalID}
		}
	}
	return refs, nil
}

func (s *AdminStore) firstCovers(ctx context.Context, ids []int) (map[int]game.AdminCover, error) {
	covers := map[int]game.AdminCover{}
	if len(ids) == 0 {
		return covers, nil
	}
	found, err := s.db(ctx).GameCover.Query().
		Where(gamecover.GameIDIn(ids...)).
		Select(gamecover.FieldGameID, gamecover.FieldURL, gamecover.FieldDims, gamecover.FieldThumbHash, gamecover.FieldSexual, gamecover.FieldViolence).
		Order(ent.Asc(gamecover.FieldGameID), ent.Asc(gamecover.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load game covers: %w", err)
	}
	for _, cover := range found {
		if _, seen := covers[cover.GameID]; !seen {
			covers[cover.GameID] = game.AdminCover{URL: cover.URL, Dims: cover.Dims, ThumbHash: cover.ThumbHash, Sexual: cover.Sexual, Violence: cover.Violence}
		}
	}
	return covers, nil
}

func (s *AdminStore) Scalar(ctx context.Context, id int) (game.Scalar, error) {
	row, err := s.db(ctx).Game.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return game.Scalar{}, game.ErrNotFound
	}
	if err != nil {
		return game.Scalar{}, fmt.Errorf("get game %d: %w", id, err)
	}
	return game.Scalar{
		BID:            row.BID,
		VID:            row.VID,
		TitleJP:        row.TitleJp,
		TitleZH:        row.TitleZh,
		TitleEN:        row.TitleEn,
		Aliases:        nonNilStrings(row.Aliases),
		IntroJP:        row.IntroJp,
		IntroZH:        row.IntroZh,
		IntroEN:        row.IntroEn,
		ReleaseDate:    row.ReleaseDate,
		ReleaseDateTBA: row.ReleaseDateTba,
		ExtraInfo:      row.ExtraInfo,
		Staffs:         row.Staffs,
		NSFW:           row.Nsfw,
		Type:           row.Type,
		Platform:       nonNilStrings(row.Platform),
		Status:         game.Status(row.Status),
	}, nil
}

func (s *AdminStore) Lock(ctx context.Context, id int) error {
	_, err := s.db(ctx).Game.Query().Where(entgame.ID(id)).ForUpdate().OnlyID(ctx)
	if postgres.IsNotFound(err) {
		return game.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lock game %d: %w", id, err)
	}
	return nil
}

func (s *AdminStore) SetStatus(ctx context.Context, id int, status game.Status) error {
	return s.update(ctx, id, s.db(ctx).Game.UpdateOneID(id).SetStatus(int(status)))
}

func (s *AdminStore) UpdateScalar(ctx context.Context, id int, c game.ScalarChanges) error {
	update := s.db(ctx).Game.UpdateOneID(id)
	setClearable(c.BID, update.SetBID, update.ClearBID)
	setClearable(c.VID, update.SetVID, update.ClearVID)
	setClearable(c.Type, update.SetType, update.ClearType)
	setClearable(c.ReleaseDate, update.SetReleaseDate, update.ClearReleaseDate)
	update.SetNillableTitleJp(c.TitleJP).SetNillableTitleZh(c.TitleZH).SetNillableTitleEn(c.TitleEN)
	update.SetNillableIntroJp(c.IntroJP).SetNillableIntroZh(c.IntroZH).SetNillableIntroEn(c.IntroEN)
	update.SetNillableReleaseDateTba(c.ReleaseDateTBA).SetNillableNsfw(c.NSFW)
	if c.Aliases != nil {
		update.SetAliases(pgvalue.Strings(nonNilStrings(*c.Aliases)))
	}
	if c.Platform != nil {
		update.SetPlatform(pgvalue.Strings(nonNilStrings(*c.Platform)))
	}
	if c.Status != nil {
		update.SetStatus(int(*c.Status))
	}
	if c.ExtraInfo.Set {
		raw, err := encodeExtraInfo(*c.ExtraInfo.Value)
		if err != nil {
			return err
		}
		update.SetExtraInfo(raw)
	}
	if c.Staffs.Set {
		raw, err := encodeStaffs(*c.Staffs.Value)
		if err != nil {
			return err
		}
		update.SetStaffs(raw)
	}
	return s.update(ctx, id, update)
}

func (s *AdminStore) update(ctx context.Context, id int, update *ent.GameUpdateOne) error {
	err := update.Exec(ctx)
	switch {
	case postgres.IsNotFound(err):
		return game.ErrNotFound
	case postgres.IsUniqueViolation(err, uniqueExternalIDs):
		return game.ErrAlreadyExists
	case err != nil:
		return fmt.Errorf("update game %d: %w", id, err)
	}
	return nil
}

func (s *AdminStore) StorageKeys(ctx context.Context, id int) ([]string, error) {
	db := s.db(ctx)
	ownedFile := gamedownloadresourcefile.HasGameDownloadResourceWith(gamedownloadresource.GameID(id))
	current, err := db.GameDownloadResourceFile.Query().
		Where(ownedFile, gamedownloadresourcefile.S3FileKeyNotNil()).
		Select(gamedownloadresourcefile.FieldS3FileKey).
		Strings(ctx)
	if err != nil {
		return nil, fmt.Errorf("list storage keys of game %d: %w", id, err)
	}
	previous, err := db.GameDownloadResourceFileHistory.Query().
		Where(gamedownloadresourcefilehistory.HasFileWith(ownedFile), gamedownloadresourcefilehistory.S3FileKeyNotNil()).
		Select(gamedownloadresourcefilehistory.FieldS3FileKey).
		Strings(ctx)
	if err != nil {
		return nil, fmt.Errorf("list previous storage keys of game %d: %w", id, err)
	}
	keys := slices.Concat(current, previous)
	slices.Sort(keys)
	return slices.Compact(keys), nil
}

func (s *AdminStore) Delete(ctx context.Context, id int) error {
	err := s.db(ctx).Game.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return game.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete game %d: %w", id, err)
	}
	return nil
}

func setClearable[T any, R any](value patch.Clearable[T], set func(T) R, clear func() R) {
	if !value.Set {
		return
	}
	if value.Value == nil {
		clear()
		return
	}
	set(*value.Value)
}

type extraInfoEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type staffEntry struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

func encodeExtraInfo(entries []game.ExtraInfo) (json.RawMessage, error) {
	out := make([]extraInfoEntry, len(entries))
	for i, entry := range entries {
		out[i] = extraInfoEntry(entry)
	}
	raw, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("encode extra info: %w", err)
	}
	return raw, nil
}

func encodeStaffs(entries []game.Staff) (json.RawMessage, error) {
	out := make([]staffEntry, len(entries))
	for i, entry := range entries {
		out[i] = staffEntry(entry)
	}
	raw, err := json.Marshal(out)
	if err != nil {
		return nil, fmt.Errorf("encode staffs: %w", err)
	}
	return raw, nil
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
