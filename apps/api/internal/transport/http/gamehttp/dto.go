package gamehttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type gamePath struct {
	ID int `path:"id"`
}

type gameRecentUpdateInput struct {
	httpapi.PageQuery
}

type bangumiResourceInput struct {
	Path string `query:"path" default:"subjects" enum:"subjects,characters,persons,episodes,indices" doc:"Bangumi v0 resource kind"`
	ID   string `query:"id" required:"true" pattern:"^[0-9]{1,20}$" doc:"Bangumi resource id"`
	Type string `query:"type" enum:"subjects,characters,persons" doc:"Optional related collection of the resource"`
}

type randomGameID *int

type gameListPageMeta struct {
	response.PageMeta
	ContentLimit int `json:"content_limit"`
}

type gameListPageDTO struct {
	Items []GameListItem   `json:"items"`
	Meta  gameListPageMeta `json:"meta"`
}

type gameImageDTO struct {
	URL      string `json:"url"`
	Dims     []int  `json:"dims"`
	Sexual   int    `json:"sexual"`
	Violence int    `json:"violence"`
}

type gameTagDTO struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
	Count   int      `json:"count"`
}

type gameTagLinkDTO struct {
	TagAlias *string    `json:"tag_alias"`
	Tag      gameTagDTO `json:"tag"`
}

type gameStaffDTO struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type gameExtraInfoDTO struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type gameLinkDTO struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Label string `json:"label"`
	URL   string `json:"url"`
}

type gameCharacterDTO struct {
	ID        int      `json:"id"`
	Image     *string  `json:"image"`
	NameJP    string   `json:"name_jp"`
	NameZH    string   `json:"name_zh"`
	NameEN    string   `json:"name_en"`
	Aliases   []string `json:"aliases"`
	IntroJP   string   `json:"intro_jp"`
	IntroZH   string   `json:"intro_zh"`
	IntroEN   string   `json:"intro_en"`
	Gender    []string `json:"gender"`
	BloodType *string  `json:"blood_type"`
	Height    *int     `json:"height"`
	Weight    *int     `json:"weight"`
	Bust      *int     `json:"bust"`
	Waist     *int     `json:"waist"`
	Hips      *int     `json:"hips"`
	Cup       *string  `json:"cup"`
	Age       *int     `json:"age"`
	Birthday  []int    `json:"birthday"`
}

type gameCharacterCreditDTO struct {
	Role      string           `json:"role" enum:"main,primary,side,appears"`
	Image     *string          `json:"image"`
	Actor     *string          `json:"actor"`
	Character gameCharacterDTO `json:"character"`
}

type gameRelationDTO struct {
	ID       int      `json:"id"`
	Relation string   `json:"relation"`
	ToGameID int      `json:"to_game_id"`
	ToGame   GameCard `json:"to_game"`
}

type gameDetailDTO struct {
	TitleJP      string                   `json:"title_jp"`
	TitleZH      string                   `json:"title_zh"`
	TitleEN      string                   `json:"title_en"`
	IntroJP      string                   `json:"intro_jp"`
	IntroZH      string                   `json:"intro_zh"`
	IntroEN      string                   `json:"intro_en"`
	Covers       []GameCover              `json:"covers"`
	Images       *[]gameImageDTO          `json:"images,omitempty" doc:"Omitted for viewers who hide rated content"`
	Developers   []GameCredit             `json:"developers"`
	Characters   []gameCharacterCreditDTO `json:"characters"`
	Staffs       []gameStaffDTO           `json:"staffs"`
	Tags         []gameTagLinkDTO         `json:"tags"`
	ContentLimit int                      `json:"content_limit"`
}

type gameHeaderDTO struct {
	ID             int                `json:"id"`
	VID            *string            `json:"v_id"`
	BID            *string            `json:"b_id"`
	HID            *int               `json:"h_id"`
	ExtraInfo      []gameExtraInfoDTO `json:"extra_info"`
	TitleJP        string             `json:"title_jp"`
	TitleZH        string             `json:"title_zh"`
	TitleEN        string             `json:"title_en"`
	Aliases        []string           `json:"aliases"`
	Covers         []GameCover        `json:"covers"`
	Developers     []GameCredit       `json:"developers"`
	ReleaseDate    *time.Time         `json:"release_date"`
	ReleaseDateTBA bool               `json:"release_date_tba"`
	Type           *string            `json:"type"`
	Platform       []string           `json:"platform"`
	ContentLimit   int                `json:"content_limit"`
}

type gameDetailsDTO struct {
	ID            int                `json:"id"`
	ExtraInfo     []gameExtraInfoDTO `json:"extra_info"`
	Tags          []gameTagLinkDTO   `json:"tags"`
	IntroJP       string             `json:"intro_jp"`
	IntroZH       string             `json:"intro_zh"`
	IntroEN       string             `json:"intro_en"`
	Images        []gameImageDTO     `json:"images"`
	Staffs        []gameStaffDTO     `json:"staffs"`
	NSFW          bool               `json:"nsfw"`
	Link          []gameLinkDTO      `json:"link"`
	RelationsFrom []gameRelationDTO  `json:"relations_from"`
	ContentLimit  int                `json:"content_limit"`
}

type gameCharactersDTO struct {
	Characters   []gameCharacterCreditDTO `json:"characters"`
	ContentLimit int                      `json:"content_limit"`
}

type bangumiRatingDTO struct {
	Rank  int            `json:"rank"`
	Total int            `json:"total"`
	Count map[string]int `json:"count"`
	Score float64        `json:"score"`
}

type bangumiScoreDTO struct {
	Rating bangumiRatingDTO `json:"rating"`
	ID     int              `json:"id"`
}

type vndbScoreDTO struct {
	ID        string   `json:"id"`
	Rating    *float64 `json:"rating"`
	Average   *float64 `json:"average"`
	VoteCount int      `json:"votecount"`
}

func mapSlice[S, T any](items []S, mapper func(S) T) []T {
	out := make([]T, len(items))
	for i, item := range items {
		out[i] = mapper(item)
	}
	return out
}

func toImageDTO(image game.Image) gameImageDTO {
	return gameImageDTO{URL: image.URL, Dims: nonNilInts(image.Dims), Sexual: image.Sexual, Violence: image.Violence}
}

func toTagLinkDTO(link game.TagLink) gameTagLinkDTO {
	return gameTagLinkDTO{TagAlias: link.Alias, Tag: gameTagDTO{ID: link.Tag.ID, Name: link.Tag.Name, Aliases: nonNil(link.Tag.Aliases), Count: link.Tag.Count}}
}

func toStaffDTO(staff game.Staff) gameStaffDTO {
	return gameStaffDTO(staff)
}

func toExtraInfoDTO(info game.ExtraInfo) gameExtraInfoDTO {
	return gameExtraInfoDTO(info)
}

func toLinkDTO(link game.Link) gameLinkDTO {
	return gameLinkDTO{ID: link.ID, Name: link.Name, Label: link.Label, URL: link.URL}
}

func toCoverDTOs(covers []game.Cover) []GameCover {
	return ToGameCard(game.Card{Covers: covers}).Covers
}

func toCreditDTOs(credits []game.Credit) []GameCredit {
	return ToGameCard(game.Card{Developers: credits}).Developers
}

func toCharacterDTO(c character.Character) gameCharacterDTO {
	return gameCharacterDTO{
		ID:        c.ID,
		Image:     c.Image,
		NameJP:    c.NameJP,
		NameZH:    valueOrEmpty(c.NameZH),
		NameEN:    valueOrEmpty(c.NameEN),
		Aliases:   nonNil(c.Aliases),
		IntroJP:   c.IntroJP,
		IntroZH:   c.IntroZH,
		IntroEN:   c.IntroEN,
		Gender:    nonNil(c.Gender),
		BloodType: c.BloodType,
		Height:    c.Height,
		Weight:    c.Weight,
		Bust:      c.Bust,
		Waist:     c.Waist,
		Hips:      c.Hips,
		Cup:       c.Cup,
		Age:       c.Age,
		Birthday:  nonNilInts(c.Birthday),
	}
}

func toCharacterCreditDTO(credit game.CharacterCredit) gameCharacterCreditDTO {
	return gameCharacterCreditDTO{Role: credit.Role, Image: credit.Image, Actor: credit.Actor, Character: toCharacterDTO(credit.Character)}
}

func toRelationDTO(relation game.Relation) gameRelationDTO {
	return gameRelationDTO{ID: relation.ID, Relation: relation.Kind, ToGameID: relation.ToGameID, ToGame: ToGameCard(relation.Target)}
}

func toDetailDTO(detail game.Detail, contentLimit int) gameDetailDTO {
	out := gameDetailDTO{
		TitleJP:      detail.TitleJP,
		TitleZH:      detail.TitleZH,
		TitleEN:      detail.TitleEN,
		IntroJP:      detail.IntroJP,
		IntroZH:      detail.IntroZH,
		IntroEN:      detail.IntroEN,
		Covers:       toCoverDTOs(detail.Covers),
		Developers:   toCreditDTOs(detail.Developers),
		Characters:   mapSlice(detail.Characters, toCharacterCreditDTO),
		Staffs:       mapSlice(detail.Staffs, toStaffDTO),
		Tags:         mapSlice(detail.Tags, toTagLinkDTO),
		ContentLimit: contentLimit,
	}
	if !detail.ImagesWithheld {
		images := mapSlice(detail.Images, toImageDTO)
		out.Images = &images
	}
	return out
}

func toHeaderDTO(detail game.Detail, contentLimit int) gameHeaderDTO {
	return gameHeaderDTO{
		ID:             detail.ID,
		VID:            detail.VID,
		BID:            detail.BID,
		HID:            detail.HID,
		ExtraInfo:      mapSlice(detail.ExtraInfo, toExtraInfoDTO),
		TitleJP:        detail.TitleJP,
		TitleZH:        detail.TitleZH,
		TitleEN:        detail.TitleEN,
		Aliases:        nonNil(detail.Aliases),
		Covers:         toCoverDTOs(detail.Covers),
		Developers:     toCreditDTOs(detail.Developers),
		ReleaseDate:    detail.ReleaseDate,
		ReleaseDateTBA: detail.ReleaseDateTBA,
		Type:           detail.Type,
		Platform:       nonNil(detail.Platforms),
		ContentLimit:   contentLimit,
	}
}

func toDetailsDTO(detail game.Detail, contentLimit int) gameDetailsDTO {
	return gameDetailsDTO{
		ID:            detail.ID,
		ExtraInfo:     mapSlice(detail.ExtraInfo, toExtraInfoDTO),
		Tags:          mapSlice(detail.Tags, toTagLinkDTO),
		IntroJP:       detail.IntroJP,
		IntroZH:       detail.IntroZH,
		IntroEN:       detail.IntroEN,
		Images:        mapSlice(detail.Images, toImageDTO),
		Staffs:        mapSlice(detail.Staffs, toStaffDTO),
		NSFW:          detail.NSFW,
		Link:          mapSlice(detail.Links, toLinkDTO),
		RelationsFrom: mapSlice(detail.Relations, toRelationDTO),
		ContentLimit:  contentLimit,
	}
}

func toBangumiScoreDTO(score *game.BangumiScore) *bangumiScoreDTO {
	if score == nil {
		return nil
	}
	count := score.Rating.Count
	if count == nil {
		count = map[string]int{}
	}
	return &bangumiScoreDTO{ID: score.ID, Rating: bangumiRatingDTO{Rank: score.Rating.Rank, Total: score.Rating.Total, Count: count, Score: score.Rating.Score}}
}

func toVNDBScoreDTO(score *game.VNDBScore) *vndbScoreDTO {
	if score == nil {
		return nil
	}
	return &vndbScoreDTO{ID: score.ID, Rating: score.Rating, Average: score.Average, VoteCount: score.VoteCount}
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
