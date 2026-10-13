package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"time"
)

//go:embed e2e_dataset.json
var e2eDatasetJSON []byte

type e2eDataset struct {
	FieldPermissionMappings []e2ePermissionMappingRow `json:"field_permission_mappings"`
	Developers              []e2eDeveloperRow         `json:"game_developers"`
	Characters              []e2eCharacterRow         `json:"game_characters"`
	Games                   []e2eGameRow              `json:"games"`
	Covers                  []e2eCoverRow             `json:"game_covers"`
	Images                  []e2eImageRow             `json:"game_images"`
	Links                   []e2eLinkRow              `json:"game_links"`
	DeveloperRelations      []e2eDeveloperRelationRow `json:"game_developer_relations"`
	CharacterRelations      []e2eCharacterRelationRow `json:"game_character_relations"`
}

type e2ePermissionMappingRow struct {
	Entity     string `json:"entity"`
	Field      string `json:"field"`
	BitIndex   int    `json:"bit_index"`
	IsRelation bool   `json:"is_relation"`
}

type e2eDeveloperRow struct {
	ID                int             `json:"id"`
	BID               *string         `json:"b_id"`
	VID               *string         `json:"v_id"`
	Name              *string         `json:"name"`
	Aliases           []string        `json:"aliases"`
	Logo              *string         `json:"logo"`
	IntroJP           *string         `json:"intro_jp"`
	IntroZH           *string         `json:"intro_zh"`
	IntroEN           *string         `json:"intro_en"`
	Website           *string         `json:"website"`
	ExtraInfo         json.RawMessage `json:"extra_info"`
	ParentDeveloperID *int            `json:"parent_developer_id"`
}

type e2eCharacterRow struct {
	ID        int      `json:"id"`
	BID       *string  `json:"b_id"`
	VID       *string  `json:"v_id"`
	Image     *string  `json:"image"`
	NameJP    *string  `json:"name_jp"`
	NameZH    *string  `json:"name_zh"`
	NameEN    *string  `json:"name_en"`
	Aliases   []string `json:"aliases"`
	IntroJP   *string  `json:"intro_jp"`
	IntroZH   *string  `json:"intro_zh"`
	IntroEN   *string  `json:"intro_en"`
	BloodType *string  `json:"blood_type"`
	Height    *int     `json:"height"`
	Weight    *int     `json:"weight"`
	Bust      *int     `json:"bust"`
	Waist     *int     `json:"waist"`
	Hips      *int     `json:"hips"`
	Cup       *string  `json:"cup"`
	Age       *int     `json:"age"`
	Birthday  []int    `json:"birthday"`
	Gender    []string `json:"gender"`
}

type e2eGameRow struct {
	ID             int             `json:"id"`
	VID            *string         `json:"v_id"`
	BID            *string         `json:"b_id"`
	TitleJP        *string         `json:"title_jp"`
	TitleZH        *string         `json:"title_zh"`
	TitleEN        *string         `json:"title_en"`
	Aliases        []string        `json:"aliases"`
	IntroJP        *string         `json:"intro_jp"`
	IntroZH        *string         `json:"intro_zh"`
	IntroEN        *string         `json:"intro_en"`
	ReleaseDate    *time.Time      `json:"release_date"`
	ReleaseDateTBA *bool           `json:"release_date_tba"`
	ExtraInfo      json.RawMessage `json:"extra_info"`
	Tags           []string        `json:"tags"`
	Staffs         json.RawMessage `json:"staffs"`
	NSFW           *bool           `json:"nsfw"`
	Type           *string         `json:"type"`
	Platform       []string        `json:"platform"`
	Status         *int            `json:"status"`
	HotScore       *float64        `json:"hot_score"`
	Views          *int            `json:"views"`
	Downloads      *int            `json:"downloads"`
}

type e2eCoverRow struct {
	GameID   int    `json:"game_id"`
	Language string `json:"language"`
	URL      string `json:"url"`
	Type     string `json:"type"`
	Dims     []int  `json:"dims"`
	Sexual   int    `json:"sexual"`
	Violence int    `json:"violence"`
}

type e2eImageRow struct {
	GameID   int    `json:"game_id"`
	URL      string `json:"url"`
	Dims     []int  `json:"dims"`
	Sexual   int    `json:"sexual"`
	Violence int    `json:"violence"`
}

type e2eLinkRow struct {
	GameID int    `json:"game_id"`
	URL    string `json:"url"`
	Label  string `json:"label"`
	Name   string `json:"name"`
}

type e2eDeveloperRelationRow struct {
	ID          int     `json:"id"`
	GameID      int     `json:"game_id"`
	DeveloperID int     `json:"developer_id"`
	Role        *string `json:"role"`
}

type e2eCharacterRelationRow struct {
	ID          int     `json:"id"`
	GameID      int     `json:"game_id"`
	CharacterID int     `json:"character_id"`
	Image       *string `json:"image"`
	Actor       *string `json:"actor"`
	Role        *string `json:"role"`
}

func loadE2EDataset() (e2eDataset, error) {
	var data e2eDataset
	if err := json.Unmarshal(e2eDatasetJSON, &data); err != nil {
		return e2eDataset{}, fmt.Errorf("decode e2e dataset: %w", err)
	}
	if len(data.Games) == 0 {
		return e2eDataset{}, fmt.Errorf("e2e dataset has no games")
	}
	return data, nil
}

func e2eGroupByGame[T any](rows []T, gameID func(T) int) map[int][]T {
	grouped := make(map[int][]T)
	for _, row := range rows {
		grouped[gameID(row)] = append(grouped[gameID(row)], row)
	}
	return grouped
}

func e2eOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func e2eJSONOrEmptyArray(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || string(raw) == "null" {
		return json.RawMessage(`[]`)
	}
	return raw
}
