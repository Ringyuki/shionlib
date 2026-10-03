package userhttp

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type userPathInput struct {
	ID int `path:"id" minimum:"1"`
}

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
