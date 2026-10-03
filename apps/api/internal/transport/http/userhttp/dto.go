package userhttp

import (
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type registerUserInput struct {
	AcceptLanguage string `header:"Accept-Language"`
	Body           struct {
		Name     string  `json:"name" minLength:"2" maxLength:"20"`
		Email    string  `json:"email" format:"email"`
		Password string  `json:"password" minLength:"8" maxLength:"50"`
		Lang     *string `json:"lang,omitempty" enum:"en,zh,ja"`
		Code     string  `json:"code" minLength:"1"`
		UUID     string  `json:"uuid" format:"uuid"`
	}
}

type userPath struct {
	ID int `path:"id" minimum:"1"`
}

type checkUserNameInput struct {
	Body struct {
		Name string `json:"name"`
	}
}

type banUserInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		BannedBy           *int    `json:"banned_by,omitempty" doc:"Ignored; the acting administrator is recorded"`
		BannedReason       *string `json:"banned_reason,omitempty" maxLength:"255"`
		BannedDurationDays *int    `json:"banned_duration_days,omitempty" minimum:"1" maximum:"999"`
		IsPermanent        *bool   `json:"is_permanent,omitempty"`
		DeleteUserComments *bool   `json:"delete_user_comments,omitempty"`
	}
}

type avatarUploadInput struct {
	RawBody huma.MultipartFormFiles[struct {
		Avatar huma.FormFile `form:"avatar" required:"false"`
	}]
}

type coverUploadInput struct {
	RawBody huma.MultipartFormFiles[struct {
		Cover huma.FormFile `form:"cover" required:"false"`
	}]
}

type updateBioInput struct {
	Body struct {
		Bio string `json:"bio" maxLength:"500"`
	}
}

type updateNameInput struct {
	Body struct {
		Name string `json:"name" minLength:"1" maxLength:"20"`
	}
}

type updateEmailInput struct {
	Body struct {
		Email       string `json:"email" format:"email"`
		CurrentUUID string `json:"currentUuid" format:"uuid"`
		CurrentCode string `json:"currentCode" minLength:"1"`
		NewUUID     string `json:"newUuid" format:"uuid"`
		NewCode     string `json:"newCode" minLength:"1"`
	}
}

type updatePasswordInput struct {
	Body struct {
		Password    string `json:"password" minLength:"1"`
		OldPassword string `json:"old_password" minLength:"1"`
	}
}

type updateLangInput struct {
	Body struct {
		Lang string `json:"lang,omitempty"`
	}
}

type updateContentLimitInput struct {
	Body struct {
		ContentLimit int `json:"content_limit,omitempty"`
	}
}

type updateOnlyGamesWithResourcesInput struct {
	Body struct {
		OnlyGamesWithResources bool `json:"only_games_with_resources"`
	}
}

type editRecordsInput struct {
	ID int `path:"id" minimum:"1"`
	httpapi.PageQuery
}

type registeredUserDTO struct {
	ID      int       `json:"id"`
	Name    string    `json:"name"`
	Email   string    `json:"email"`
	Role    int       `json:"role"`
	Created time.Time `json:"created"`
}

type userMeDTO struct {
	ID                     int        `json:"id"`
	Name                   string     `json:"name"`
	Email                  string     `json:"email"`
	Avatar                 *string    `json:"avatar"`
	Cover                  *string    `json:"cover"`
	Bio                    *string    `json:"bio"`
	Role                   int        `json:"role"`
	Lang                   string     `json:"lang"`
	ContentLimit           int        `json:"content_limit"`
	OnlyGamesWithResources bool       `json:"only_games_with_resources"`
	SponsorExpiresAt       *time.Time `json:"sponsor_expires_at"`
	IsSponsor              bool       `json:"is_sponsor"`
}

type userProfileDTO struct {
	ID               int        `json:"id"`
	Name             string     `json:"name"`
	Avatar           *string    `json:"avatar"`
	Role             int        `json:"role"`
	Bio              *string    `json:"bio"`
	Cover            *string    `json:"cover"`
	Created          time.Time  `json:"created"`
	Status           int        `json:"status"`
	SponsorExpiresAt *time.Time `json:"sponsor_expires_at"`
	IsSponsor        bool       `json:"is_sponsor"`
	ResourceCount    int        `json:"resource_count"`
	CommentCount     int        `json:"comment_count"`
	FavoriteCount    int        `json:"favorite_count"`
	EditCount        int        `json:"edit_count"`
	WalkthroughCount int        `json:"walkthrough_count"`
}

type userNameCheckDTO struct {
	Exists bool `json:"exists"`
}

type userBioDTO struct {
	Bio string `json:"bio"`
}

type userNameDTO struct {
	Name string `json:"name"`
}

type emailCodeDTO struct {
	UUID string `json:"uuid"`
}

type editRecordDTO struct {
	ID           int             `json:"id"`
	Entity       string          `json:"entity"`
	TargetID     int             `json:"target_id"`
	Action       string          `json:"action"`
	FieldChanges []string        `json:"field_changes"`
	Changes      json.RawMessage `json:"changes"`
	RelationType *string         `json:"relation_type"`
	Created      time.Time       `json:"created"`
	Updated      time.Time       `json:"updated"`
	EntityInfo   any             `json:"entity_info"`
}

type editedGameDTO struct {
	ID      int              `json:"id"`
	TitleJP string           `json:"title_jp"`
	TitleZH string           `json:"title_zh"`
	TitleEN string           `json:"title_en"`
	IntroJP string           `json:"intro_jp"`
	IntroZH string           `json:"intro_zh"`
	IntroEN string           `json:"intro_en"`
	Covers  []editedCoverDTO `json:"covers"`
}

type editedCoverDTO struct {
	URL      string `json:"url"`
	Language string `json:"language"`
	Dims     []int  `json:"dims"`
	Sexual   int    `json:"sexual"`
	Violence int    `json:"violence"`
}

type editedCharacterDTO struct {
	ID     int     `json:"id"`
	NameJP string  `json:"name_jp"`
	NameZH *string `json:"name_zh"`
	NameEN *string `json:"name_en"`
}

type editedDeveloperDTO struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases"`
}

func toMeDTO(u user.User, now time.Time) userMeDTO {
	return userMeDTO{
		ID:                     u.ID,
		Name:                   u.Name,
		Email:                  u.Email,
		Avatar:                 u.Avatar,
		Cover:                  u.Cover,
		Bio:                    u.Bio,
		Role:                   int(u.Role),
		Lang:                   string(u.Lang),
		ContentLimit:           int(u.ContentLimit),
		OnlyGamesWithResources: u.OnlyGamesWithResources,
		SponsorExpiresAt:       u.SponsorExpiresAt,
		IsSponsor:              u.IsSponsor(now),
	}
}

func toProfileDTO(p user.Profile, now time.Time) userProfileDTO {
	return userProfileDTO{
		ID:               p.ID,
		Name:             p.Name,
		Avatar:           p.Avatar,
		Role:             int(p.Role),
		Bio:              p.Bio,
		Cover:            p.Cover,
		Created:          p.Created,
		Status:           int(p.Status),
		SponsorExpiresAt: p.SponsorExpiresAt,
		IsSponsor:        p.IsSponsor(now),
		ResourceCount:    p.Resources,
		CommentCount:     p.Comments,
		FavoriteCount:    p.FavoriteItems,
		EditCount:        p.Edits,
		WalkthroughCount: p.Walkthroughs,
	}
}

func toEditRecordDTO(r user.EditRecord) editRecordDTO {
	out := editRecordDTO{
		ID:           r.ID,
		Entity:       r.Entity,
		TargetID:     r.TargetID,
		Action:       r.Action,
		FieldChanges: r.FieldChanges,
		Changes:      r.Changes,
		RelationType: r.RelationType,
		Created:      r.Created,
		Updated:      r.Updated,
	}
	if len(out.Changes) == 0 {
		out.Changes = json.RawMessage("null")
	}
	switch {
	case r.Game != nil:
		game := editedGameDTO{ID: r.Game.ID, TitleJP: r.Game.TitleJP, TitleZH: r.Game.TitleZH, TitleEN: r.Game.TitleEN, IntroJP: r.Game.IntroJP, IntroZH: r.Game.IntroZH, IntroEN: r.Game.IntroEN, Covers: make([]editedCoverDTO, len(r.Game.Covers))}
		for i, cover := range r.Game.Covers {
			game.Covers[i] = editedCoverDTO{URL: cover.URL, Language: cover.Language, Dims: cover.Dims, Sexual: cover.Sexual, Violence: cover.Violence}
		}
		out.EntityInfo = game
	case r.Character != nil:
		out.EntityInfo = editedCharacterDTO{ID: r.Character.ID, NameJP: r.Character.NameJP, NameZH: r.Character.NameZH, NameEN: r.Character.NameEN}
	case r.Developer != nil:
		out.EntityInfo = editedDeveloperDTO{ID: r.Developer.ID, Name: r.Developer.Name, Aliases: r.Developer.Aliases}
	}
	return out
}
