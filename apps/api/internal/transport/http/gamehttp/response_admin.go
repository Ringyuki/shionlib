package gamehttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type adminGameExtraInfoDTO struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type adminGameStaffDTO struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type adminGameCoverDTO struct {
	URL string `json:"url"`
}

type adminGameCreatorDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type adminGameItemDTO struct {
	ID        int                 `json:"id"`
	TitleJP   string              `json:"title_jp"`
	TitleZH   string              `json:"title_zh"`
	TitleEN   string              `json:"title_en"`
	Status    int                 `json:"status"`
	Views     int                 `json:"views"`
	Downloads int                 `json:"downloads"`
	NSFW      bool                `json:"nsfw"`
	Created   time.Time           `json:"created"`
	Updated   time.Time           `json:"updated"`
	Covers    []adminGameCoverDTO `json:"covers" doc:"At most one cover, kept for compatibility"`
	Creator   adminGameCreatorDTO `json:"creator"`
	Cover     *string             `json:"cover,omitempty"`
}

func toAdminGameItem(entry game.AdminEntry) adminGameItemDTO {
	covers := []adminGameCoverDTO{}
	if entry.CoverURL != nil {
		covers = append(covers, adminGameCoverDTO{URL: *entry.CoverURL})
	}
	return adminGameItemDTO{
		ID:        entry.ID,
		TitleJP:   entry.TitleJP,
		TitleZH:   entry.TitleZH,
		TitleEN:   entry.TitleEN,
		Status:    int(entry.Status),
		Views:     entry.Views,
		Downloads: entry.Downloads,
		NSFW:      entry.NSFW,
		Created:   entry.Created,
		Updated:   entry.Updated,
		Covers:    covers,
		Creator:   adminGameCreatorDTO{ID: entry.Creator.ID, Name: entry.Creator.Name},
		Cover:     entry.CoverURL,
	}
}

type adminGameScalarDTO struct {
	BID            *string         `json:"b_id"`
	VID            *string         `json:"v_id"`
	TitleJP        string          `json:"title_jp"`
	TitleZH        string          `json:"title_zh"`
	TitleEN        string          `json:"title_en"`
	Aliases        []string        `json:"aliases"`
	IntroJP        string          `json:"intro_jp"`
	IntroZH        string          `json:"intro_zh"`
	IntroEN        string          `json:"intro_en"`
	ReleaseDate    *time.Time      `json:"release_date"`
	ReleaseDateTBA bool            `json:"release_date_tba"`
	ExtraInfo      json.RawMessage `json:"extra_info"`
	Staffs         json.RawMessage `json:"staffs"`
	NSFW           bool            `json:"nsfw"`
	Type           *string         `json:"type"`
	Platform       []string        `json:"platform"`
	Status         int             `json:"status"`
}

func toAdminGameScalar(s game.Scalar) adminGameScalarDTO {
	return adminGameScalarDTO{
		BID:            s.BID,
		VID:            s.VID,
		TitleJP:        s.TitleJP,
		TitleZH:        s.TitleZH,
		TitleEN:        s.TitleEN,
		Aliases:        nonNilStrings(s.Aliases),
		IntroJP:        s.IntroJP,
		IntroZH:        s.IntroZH,
		IntroEN:        s.IntroEN,
		ReleaseDate:    s.ReleaseDate,
		ReleaseDateTBA: s.ReleaseDateTBA,
		ExtraInfo:      s.ExtraInfo,
		Staffs:         s.Staffs,
		NSFW:           s.NSFW,
		Type:           s.Type,
		Platform:       nonNilStrings(s.Platform),
		Status:         int(s.Status),
	}
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
