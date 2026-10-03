package hikarinagi

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

var staffRoles = map[string]string{
	"GAME_DESIGNER":        "游戏设计师",
	"DIRECTOR":             "导演",
	"PRODUCER":             "制作人",
	"SUPERVISOR":           "监修",
	"EXECUTIVE_PRODUCER":   "制作总指挥",
	"ORIGINAL_WORK":        "原作",
	"CHARACTER_DESIGN":     "人物设定",
	"MECHANICAL_DESIGN":    "机械设定",
	"LEVEL_DESIGN":         "关卡设计",
	"PLANNING":             "企画",
	"PROGRAM":              "程序",
	"QC":                   "QC",
	"SCENARIO":             "剧本",
	"SERIES_COMPOSITION":   "系列构成",
	"ANIMATION_SUPERVISOR": "作画监督",
	"ART":                  "原画",
	"GRAPHICS":             "美工",
	"CG_SUPERVISOR":        "CG 监修",
	"SD_ART":               "SD原画",
	"BACKGROUND":           "背景",
	"COVER_ART":            "海报",
	"SOUND_DIRECTOR":       "音响监督",
	"MUSIC":                "音乐",
	"THEME_COMPOSITION":    "主题歌作曲",
	"THEME_LYRICS":         "主题歌作词",
	"THEME_PERFORMANCE":    "主题歌演出",
	"INSERT_PERFORMANCE":   "插入歌演出",
	"ANIMATION_PRODUCTION": "动画制作",
	"ANIMATION_DIRECTOR":   "动画监督",
	"ANIMATION_SCRIPT":     "动画剧本",
	"COOPERATION":          "协力",
	"TRANSLATOR":           "翻译",
	"EDITOR":               "编辑",
}

var changeEntities = map[string]catalog.Entity{
	"GALGAME":   catalog.EntityGame,
	"PRODUCER":  catalog.EntityDeveloper,
	"CHARACTER": catalog.EntityCharacter,
}

type Source struct {
	client *Client
}

func NewSource(client *Client) *Source {
	return &Source{client: client}
}

func (s *Source) Name() string {
	return catalog.SourceHikarinagi
}

func (s *Source) Game(ctx context.Context, externalID string) (catalog.GameSnapshot, error) {
	id, err := numericID(externalID)
	if err != nil {
		return catalog.GameSnapshot{}, err
	}
	base := "/open/galgames/" + id
	var detail galgameDetailDTO
	if err := s.client.get(ctx, base, nil, &detail); err != nil {
		return catalog.GameSnapshot{}, err
	}
	var staff []galgameStaffDTO
	if err := s.client.get(ctx, base+"/staff", nil, &staff); err != nil {
		return catalog.GameSnapshot{}, err
	}
	var characters []galgameCharacterDTO
	if err := s.client.get(ctx, base+"/characters", nil, &characters); err != nil {
		return catalog.GameSnapshot{}, err
	}
	var producers []galgameProducerDTO
	if err := s.client.get(ctx, base+"/producers", nil, &producers); err != nil {
		return catalog.GameSnapshot{}, err
	}
	var relations []galgameRelationDTO
	if err := s.client.get(ctx, base+"/relations", nil, &relations); err != nil {
		return catalog.GameSnapshot{}, err
	}
	return toGameSnapshot(detail, staff, characters, producers, relations), nil
}

func (s *Source) Developer(ctx context.Context, externalID string) (catalog.DeveloperSnapshot, error) {
	id, err := numericID(externalID)
	if err != nil {
		return catalog.DeveloperSnapshot{}, err
	}
	var detail producerDetailDTO
	if err := s.client.get(ctx, "/open/producers/"+id, nil, &detail); err != nil {
		return catalog.DeveloperSnapshot{}, err
	}
	return toDeveloperSnapshot(detail), nil
}

func (s *Source) Character(ctx context.Context, externalID string) (catalog.CharacterSnapshot, error) {
	id, err := numericID(externalID)
	if err != nil {
		return catalog.CharacterSnapshot{}, err
	}
	var detail characterDetailDTO
	if err := s.client.get(ctx, "/open/characters/"+id, nil, &detail); err != nil {
		return catalog.CharacterSnapshot{}, err
	}
	return toCharacterSnapshot(detail), nil
}

func (s *Source) SearchGames(ctx context.Context, query string, page, size int) ([]catalog.SearchHit, int, error) {
	params := url.Values{
		"q":         {query},
		"types":     {"galgame"},
		"page":      {strconv.Itoa(page)},
		"page_size": {strconv.Itoa(size)},
	}
	var result searchPageDTO
	if err := s.client.get(ctx, "/open/search", params, &result); err != nil {
		return nil, 0, err
	}
	hits := make([]catalog.SearchHit, 0, len(result.Items))
	for _, item := range result.Items {
		if item.Type != "galgame" {
			continue
		}
		hit := catalog.SearchHit{ExternalID: itoa(item.ID), Title: item.Title, Subtitle: item.Subtitle, Developer: item.Developer}
		if item.Cover != nil {
			cover := item.Cover.URL
			hit.CoverURL = &cover
		}
		hits = append(hits, hit)
	}
	return hits, result.Meta.TotalItems, nil
}

func (s *Source) Changes(ctx context.Context, cursor string, limit int) (catalog.ChangeBatch, error) {
	since := cursor
	if since == "" {
		since = "0"
	}
	params := url.Values{"since": {since}, "limit": {strconv.Itoa(limit)}}
	var result changesDTO
	if err := s.client.get(ctx, "/open/catalog/changes", params, &result); err != nil {
		return catalog.ChangeBatch{}, err
	}
	batch := catalog.ChangeBatch{Cursor: cursor, HasMore: result.HasMore}
	for _, item := range result.Items {
		batch.Cursor = strconv.FormatInt(item.ID, 10)
		entity, ok := changeEntities[item.ResourceType]
		if !ok {
			continue
		}
		change := catalog.Change{Entity: entity, ExternalID: itoa(item.ResourceID), Kind: catalog.ChangeKind(strings.ToUpper(item.Kind))}
		if item.MergedToID != nil {
			change.MergedInto = itoa(*item.MergedToID)
		}
		batch.Changes = append(batch.Changes, change)
	}
	return batch, nil
}

func toGameSnapshot(detail galgameDetailDTO, staff []galgameStaffDTO, characters []galgameCharacterDTO, producers []galgameProducerDTO, relations []galgameRelationDTO) catalog.GameSnapshot {
	originLang := deref(detail.OriginLang)
	snapshot := catalog.GameSnapshot{
		ExternalID:     itoa(detail.ID),
		Title:          catalog.Localized{Origin: detail.OriginTitle, OriginLang: originLang, Translated: detail.TransTitle, English: detail.EnTitle},
		Intro:          catalog.Localized{Origin: deref(detail.OriginIntro), OriginLang: originLang, Translated: detail.TransIntro, English: detail.EnIntro},
		Aliases:        detail.Aliases,
		ReleaseDate:    releaseDate(detail.ReleaseDate),
		ReleaseDateTBD: detail.ReleaseDateTBD,
		Type:           detail.AdvType,
		Platforms:      detail.Platforms,
		NSFW:           detail.NSFW,
		External:       catalog.ExternalIDs{VNDB: detail.VNDBID.pointer(), Bangumi: detail.BangumiID.pointer()},
		Revision:       revision(detail.RevisedAt, detail.UpdatedAt),
	}
	for _, cover := range detail.Covers {
		snapshot.Covers = append(snapshot.Covers, catalog.Cover{Media: toMedia(cover.mediaDTO), Votes: cover.Votes, Language: deref(cover.Language), Kind: deref(cover.Kind)})
	}
	for _, image := range detail.Images {
		snapshot.Images = append(snapshot.Images, toMedia(image))
	}
	for _, tag := range detail.Tags {
		snapshot.Tags = append(snapshot.Tags, tag.Name)
	}
	for _, link := range detail.ExternalLinks {
		snapshot.Links = append(snapshot.Links, catalog.Link{Name: link.Name, Label: link.Label, URL: link.URL})
	}
	for _, row := range staff {
		role := ""
		if row.Role != nil {
			role = *row.Role
			if label, ok := staffRoles[role]; ok {
				role = label
			}
		}
		snapshot.Staff = append(snapshot.Staff, catalog.Staff{Name: row.Person.Name, Role: role})
	}
	for _, row := range producers {
		snapshot.Developers = append(snapshot.Developers, catalog.DeveloperCredit{
			ExternalID: itoa(row.Producer.ID),
			Name:       row.Producer.Name,
			Role:       deref(row.Role),
			Logo:       optionalMedia(row.Producer.Image),
		})
	}
	for _, row := range characters {
		credit := catalog.CharacterCredit{
			ExternalID: itoa(row.Character.ID),
			Name:       row.Character.Name,
			Translated: row.Character.TransName,
			Image:      optionalMedia(row.Character.Image),
			Role:       row.Role,
		}
		for _, actor := range row.Actors {
			name := actor.Name
			if actor.TransName != nil && *actor.TransName != "" {
				name = *actor.TransName
			}
			credit.Actors = append(credit.Actors, name)
		}
		snapshot.Characters = append(snapshot.Characters, credit)
	}
	for _, row := range relations {
		snapshot.Relations = append(snapshot.Relations, catalog.Relation{ExternalID: itoa(row.Galgame.ID), Type: row.Relation})
	}
	return snapshot
}

func toDeveloperSnapshot(detail producerDetailDTO) catalog.DeveloperSnapshot {
	snapshot := catalog.DeveloperSnapshot{
		ExternalID: itoa(detail.ID),
		Name:       detail.Name,
		Aliases:    detail.Aliases,
		Intro:      catalog.Localized{Origin: deref(detail.Intro), OriginLang: "ja", Translated: detail.TransIntro, English: detail.EnIntro},
		Website:    detail.Website,
		Logo:       optionalMedia(detail.Logo),
		External:   catalog.ExternalIDs{VNDB: detail.VNDBID.pointer(), Bangumi: detail.BangumiID.pointer()},
		Revision:   revision(detail.RevisedAt, detail.UpdatedAt),
	}
	for _, label := range detail.Labels {
		snapshot.Extra = append(snapshot.Extra, catalog.KeyValue{Key: label.Key, Value: label.Value})
	}
	return snapshot
}

func toCharacterSnapshot(detail characterDetailDTO) catalog.CharacterSnapshot {
	snapshot := catalog.CharacterSnapshot{
		ExternalID: itoa(detail.ID),
		Name:       catalog.Localized{Origin: detail.Name, OriginLang: "ja", Translated: detail.TransName, English: detail.EnName},
		Aliases:    detail.Aliases,
		Intro:      catalog.Localized{Origin: detail.Intro, OriginLang: "ja", Translated: detail.TransIntro, English: detail.EnIntro},
		Image:      optionalMedia(detail.Image),
		BloodType:  detail.BloodType,
		Height:     detail.Height,
		Weight:     detail.Weight,
		Bust:       detail.Bust,
		Waist:      detail.Waist,
		Hips:       detail.Hips,
		Cup:        detail.Cup,
		Age:        detail.Age,
		External:   catalog.ExternalIDs{VNDB: detail.VNDBID.pointer(), Bangumi: detail.BangumiID.pointer()},
		Revision:   revision(detail.RevisedAt, detail.UpdatedAt),
	}
	if detail.Gender != nil && *detail.Gender != "" {
		snapshot.Gender = []string{*detail.Gender}
	}
	if detail.BirthdayMonth != nil && detail.BirthdayDay != nil {
		snapshot.Birthday = []int{*detail.BirthdayMonth, *detail.BirthdayDay}
	}
	return snapshot
}

func toMedia(media mediaDTO) catalog.Media {
	return catalog.Media{URL: media.URL, Width: media.Width, Height: media.Height, Sexual: media.Sexual, Violence: media.Violence}
}

func optionalMedia(media *mediaDTO) *catalog.Media {
	if media == nil || media.URL == "" {
		return nil
	}
	converted := toMedia(*media)
	return &converted
}

func releaseDate(raw *string) *time.Time {
	if raw == nil || *raw == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, time.DateOnly} {
		if parsed, err := time.Parse(layout, *raw); err == nil {
			return &parsed
		}
	}
	return nil
}

func numericID(externalID string) (string, error) {
	id, err := strconv.Atoi(externalID)
	if err != nil || id <= 0 {
		return "", catalog.ErrNotFound
	}
	return strconv.Itoa(id), nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
