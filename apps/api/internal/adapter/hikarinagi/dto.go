package hikarinagi

import (
	"bytes"
	"encoding/json"
	"strconv"
)

type externalID string

func (e *externalID) UnmarshalJSON(raw []byte) error {
	raw = bytes.TrimSpace(raw)
	if bytes.Equal(raw, []byte("null")) {
		*e = ""
		return nil
	}
	if len(raw) > 0 && raw[0] == '"' {
		var text string
		if err := json.Unmarshal(raw, &text); err != nil {
			return err
		}
		*e = externalID(text)
		return nil
	}
	var number json.Number
	if err := json.Unmarshal(raw, &number); err != nil {
		return err
	}
	*e = externalID(number.String())
	return nil
}

func (e externalID) pointer() *string {
	if e == "" {
		return nil
	}
	value := string(e)
	return &value
}

type mediaDTO struct {
	URL      string `json:"url"`
	Width    *int   `json:"width"`
	Height   *int   `json:"height"`
	Sexual   int    `json:"sexual"`
	Violence int    `json:"violence"`
}

type coverDTO struct {
	mediaDTO
	Votes    int     `json:"votes"`
	Language *string `json:"language"`
	Kind     *string `json:"kind"`
}

type entityRefDTO struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	TransName *string   `json:"trans_name"`
	Image     *mediaDTO `json:"image"`
}

type labelDTO struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type tagDTO struct {
	Name string `json:"name"`
}

type linkDTO struct {
	Name  string `json:"name"`
	Label string `json:"label"`
	URL   string `json:"url"`
}

type galgameDetailDTO struct {
	ID             int        `json:"id"`
	OriginTitle    string     `json:"origin_title"`
	OriginLang     *string    `json:"origin_lang"`
	TransTitle     *string    `json:"trans_title"`
	EnTitle        *string    `json:"en_title"`
	OriginIntro    *string    `json:"origin_intro"`
	TransIntro     *string    `json:"trans_intro"`
	EnIntro        *string    `json:"en_intro"`
	Aliases        []string   `json:"aliases"`
	AdvType        *string    `json:"adv_type"`
	Platforms      []string   `json:"platforms"`
	NSFW           bool       `json:"nsfw"`
	ReleaseDate    *string    `json:"release_date"`
	ReleaseDateTBD bool       `json:"release_date_tbd"`
	Covers         []coverDTO `json:"covers"`
	Images         []mediaDTO `json:"images"`
	Tags           []tagDTO   `json:"tags"`
	ExternalLinks  []linkDTO  `json:"external_links"`
	VNDBID         externalID `json:"vndb_id"`
	BangumiID      externalID `json:"bangumi_id"`
	RevisedAt      *string    `json:"revised_at"`
	UpdatedAt      string     `json:"updated_at"`
}

type galgameStaffDTO struct {
	Person entityRefDTO `json:"person"`
	Role   *string      `json:"role"`
}

type galgameCharacterDTO struct {
	Character entityRefDTO   `json:"character"`
	Actors    []entityRefDTO `json:"actors"`
	Role      string         `json:"role"`
}

type galgameProducerDTO struct {
	Producer entityRefDTO `json:"producer"`
	Role     *string      `json:"role"`
}

type galgameRelationDTO struct {
	Galgame struct {
		ID int `json:"id"`
	} `json:"galgame"`
	Relation string `json:"relation"`
}

type producerDetailDTO struct {
	ID         int        `json:"id"`
	Name       string     `json:"name"`
	Aliases    []string   `json:"aliases"`
	Intro      *string    `json:"intro"`
	TransIntro *string    `json:"trans_intro"`
	EnIntro    *string    `json:"en_intro"`
	Website    *string    `json:"website"`
	Logo       *mediaDTO  `json:"logo"`
	Labels     []labelDTO `json:"labels"`
	VNDBID     externalID `json:"vndb_id"`
	BangumiID  externalID `json:"bangumi_id"`
	RevisedAt  *string    `json:"revised_at"`
	UpdatedAt  string     `json:"updated_at"`
}

type characterDetailDTO struct {
	ID            int        `json:"id"`
	Name          string     `json:"name"`
	TransName     *string    `json:"trans_name"`
	EnName        *string    `json:"en_name"`
	Aliases       []string   `json:"aliases"`
	Intro         string     `json:"intro"`
	TransIntro    *string    `json:"trans_intro"`
	EnIntro       *string    `json:"en_intro"`
	Image         *mediaDTO  `json:"image"`
	Gender        *string    `json:"gender"`
	BloodType     *string    `json:"blood_type"`
	Height        *int       `json:"height"`
	Weight        *int       `json:"weight"`
	Bust          *int       `json:"bust"`
	Waist         *int       `json:"waist"`
	Hips          *int       `json:"hips"`
	Cup           *string    `json:"cup"`
	Age           *int       `json:"age"`
	BirthdayMonth *int       `json:"birthday_month"`
	BirthdayDay   *int       `json:"birthday_day"`
	VNDBID        externalID `json:"vndb_id"`
	BangumiID     externalID `json:"bangumi_id"`
	RevisedAt     *string    `json:"revised_at"`
	UpdatedAt     string     `json:"updated_at"`
}

type searchHitDTO struct {
	ID        int       `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Subtitle  *string   `json:"subtitle"`
	Developer *string   `json:"developer"`
	Cover     *mediaDTO `json:"cover"`
}

type searchPageDTO struct {
	Items []searchHitDTO `json:"items"`
	Meta  struct {
		TotalItems int `json:"total_items"`
	} `json:"meta"`
}

type changeDTO struct {
	ID           int64  `json:"id"`
	ResourceType string `json:"resource_type"`
	ResourceID   int    `json:"resource_id"`
	Kind         string `json:"kind"`
	MergedToID   *int   `json:"merged_to_id"`
}

type changesDTO struct {
	Items    []changeDTO `json:"items"`
	LatestID int64       `json:"latest_id"`
	HasMore  bool        `json:"has_more"`
}

func revision(revisedAt *string, updatedAt string) string {
	if revisedAt != nil && *revisedAt != "" {
		return *revisedAt
	}
	return updatedAt
}

func itoa(value int) string {
	return strconv.Itoa(value)
}
